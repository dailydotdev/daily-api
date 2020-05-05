export class UnauthorizedError extends Error {
  constructor() {
    super('Access denied! You need to be authorized to perform this action!');
    this.name = 'UnauthorizedError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ForbiddenError extends Error {
  constructor() {
    super("Access denied! You don't have permission for this action!");
    this.name = 'ForbiddenError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class ValidationError extends Error {
  errors: string[];

  constructor(errors) {
    super('Field validation failed');
    this.name = 'ValidationError';
    this.errors = errors;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class NotFound extends Error {
  constructor() {
    super('Requested entity could not be found');
    this.name = 'NotFoundError';
    Object.setPrototypeOf(this, new.target.prototype);
  }
}
