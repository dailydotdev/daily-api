export class EntityNotFoundError extends Error {
  constructor(entityName, fieldName, fieldValue) {
    super(`No ${entityName} found that matches ${fieldName}: ${fieldValue}`);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.entityName = entityName;
    this.fieldName = fieldName;
    this.fieldValue = fieldValue;
  }
}

export class ValidationError extends Error {
  constructor(field, reason) {
    super(reason);
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
    this.field = field;
    this.reason = reason;
  }
}
