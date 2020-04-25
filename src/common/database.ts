export function partialUpdate<Entity extends object>(
  entity: Entity,
  update: Partial<Entity>,
): Entity {
  Object.keys(update).forEach((key) => {
    if (entity[key] !== undefined) {
      entity[key] = update[key];
    }
  });
  return entity;
}
