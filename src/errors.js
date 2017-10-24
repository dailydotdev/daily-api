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

export class EntityExistError extends Error {
  constructor(entityName, fieldName, fieldValue) {
    super(`${entityName} that matches ${fieldName}: ${fieldValue} already exists`);
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

export class ForbiddenError extends Error {
  constructor() {
    super('Method is forbidden');
    Error.captureStackTrace(this, this.constructor);

    this.name = this.constructor.name;
  }
}
