import { createBooleanNode, createGroupNode, createTermNode } from "../ast/index.js";

const OPERATOR_PATTERN = /^(>=|<=|:|=|>|<)$/;

function isWhitespace(character) {
  return /\s/.test(character);
}

function isBoundaryCharacter(character) {
  return character === undefined || isWhitespace(character) || character === "(" || character === ")";
}

function tokenize(query) {
  const tokens = [];
  let index = 0;

  while (index < query.length) {
    const character = query[index];

    if (isWhitespace(character)) {
      index += 1;
      continue;
    }

    if (character === "(" || character === ")") {
      tokens.push({ type: character });
      index += 1;
      continue;
    }

    if (character === "-") {
      tokens.push({ type: "NOT" });
      index += 1;
      continue;
    }

    let end = index;
    let inQuotes = false;
    let escaping = false;

    while (end < query.length) {
      const current = query[end];

      if (escaping) {
        escaping = false;
        end += 1;
        continue;
      }

      if (current === "\\") {
        escaping = true;
        end += 1;
        continue;
      }

      if (current === "\"") {
        inQuotes = !inQuotes;
        end += 1;
        continue;
      }

      if (!inQuotes && (isWhitespace(current) || current === "(" || current === ")")) {
        break;
      }

      end += 1;
    }

    if (inQuotes) {
      throw new Error(`Unterminated quoted string starting at position ${index + 1}.`);
    }

    const raw = query.slice(index, end);
    const lowered = raw.toLowerCase();

    if ((lowered === "or" || lowered === "and") && isBoundaryCharacter(query[end])) {
      tokens.push({ type: lowered.toUpperCase() });
    } else {
      tokens.push({ type: "TERM", value: raw });
    }

    index = end;
  }

  return tokens;
}

function unescapeQuotedValue(value) {
  let result = "";
  let escaping = false;

  for (let index = 0; index < value.length; index += 1) {
    const character = value[index];

    if (escaping) {
      result += character;
      escaping = false;
      continue;
    }

    if (character === "\\") {
      escaping = true;
      continue;
    }

    result += character;
  }

  if (escaping) {
    result += "\\";
  }

  return result;
}

function parseRawTerm(rawTerm) {
  const match = rawTerm.match(/^([^:><=]+)(>=|<=|:|=|>|<)(.+)$/);

  if (!match) {
    const isQuoted = rawTerm.startsWith("\"") && rawTerm.endsWith("\"");
    return {
      field: "name",
      operator: ":",
      value: isQuoted ? unescapeQuotedValue(rawTerm.slice(1, -1)) : rawTerm,
      implicit: true,
      ...(isQuoted ? { quoted: true } : {}),
    };
  }

  const [, field, operator, value] = match;

  if (!OPERATOR_PATTERN.test(operator)) {
    throw new Error(`Unsupported operator "${operator}" in term "${rawTerm}".`);
  }

  if (!value.length) {
    throw new Error(`Missing value in term "${rawTerm}".`);
  }

  const isQuoted = value.startsWith("\"") && value.endsWith("\"");
  const normalizedValue = isQuoted ? unescapeQuotedValue(value.slice(1, -1)) : value;

  return {
    field,
    operator,
    value: normalizedValue,
    ...(isQuoted ? { quoted: true } : {}),
  };
}

function mergeImplicitBareNameTerms(clauses) {
  const merged = [];

  for (const clause of clauses) {
    const previous = merged[merged.length - 1];
    const canMerge =
      previous &&
      previous.type === "term" &&
      clause?.type === "term" &&
      previous.field === "name" &&
      clause.field === "name" &&
      previous.operator === ":" &&
      clause.operator === ":" &&
      previous.implicit &&
      clause.implicit &&
      !previous.negated &&
      !clause.negated &&
      !previous.quoted &&
      !clause.quoted;

    if (canMerge) {
      previous.value = `${previous.value} ${clause.value}`;
      continue;
    }

    merged.push(clause);
  }

  return merged;
}

export function createParser() {
  return {
    parse(query) {
      if (typeof query !== "string" || !query.trim()) {
        throw new Error("Query must be a non-empty string.");
      }

      const tokens = tokenize(query);
      let position = 0;

      function peek() {
        return tokens[position];
      }

      function consume(expectedType) {
        const token = tokens[position];
        if (!token || token.type !== expectedType) {
          throw new Error(`Expected token "${expectedType}" but found "${token?.type ?? "EOF"}".`);
        }

        position += 1;
        return token;
      }

      function parsePrimary() {
        const token = peek();

        if (!token) {
          throw new Error("Unexpected end of query.");
        }

        if (token.type === "TERM") {
          position += 1;
          return createTermNode(parseRawTerm(token.value));
        }

        if (token.type === "(") {
          consume("(");
          const clause = parseOrExpression();
          consume(")");
          return createGroupNode(clause);
        }

        throw new Error(`Unexpected token "${token.type}".`);
      }

      function parseUnary() {
        const token = peek();
        if (token?.type === "NOT") {
          consume("NOT");
          const clause = parseUnary();

          if (clause.type === "term") {
            return createTermNode({ ...clause, negated: !clause.negated });
          }

          return createGroupNode(clause, true);
        }

        return parsePrimary();
      }

      function parseAndExpression() {
        const clauses = [parseUnary()];

        while (true) {
          const token = peek();
          if (!token || token.type === ")" || token.type === "OR") {
            break;
          }

          if (token.type === "AND") {
            consume("AND");
          }

          clauses.push(parseUnary());
        }

        const normalizedClauses = mergeImplicitBareNameTerms(clauses);

        if (normalizedClauses.length === 1) {
          return normalizedClauses[0];
        }

        return createBooleanNode("and", normalizedClauses);
      }

      function parseOrExpression() {
        const clauses = [parseAndExpression()];

        while (peek()?.type === "OR") {
          consume("OR");
          clauses.push(parseAndExpression());
        }

        if (clauses.length === 1) {
          return clauses[0];
        }

        return createBooleanNode("or", clauses);
      }

      const ast = parseOrExpression();
      if (position < tokens.length) {
        throw new Error(`Unexpected token "${tokens[position].type}" at the end of the query.`);
      }

      return ast;
    },
  };
}
