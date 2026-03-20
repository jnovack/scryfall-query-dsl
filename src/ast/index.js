export function createTermNode({ field, operator, value, negated = false, ...meta }) {
  return {
    type: "term",
    field,
    operator,
    value,
    negated,
    ...meta,
  };
}

export function createBooleanNode(operator, clauses) {
  return {
    type: "boolean",
    operator,
    clauses,
  };
}

export function createGroupNode(clause, negated = false) {
  return {
    type: "group",
    clause,
    negated,
  };
}
