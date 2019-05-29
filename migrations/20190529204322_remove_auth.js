exports.up = async (knex) => {
  await knex.schema.dropTableIfExists('refresh_tokens');
  await knex.schema.dropTableIfExists('providers');
  return knex.schema.dropTableIfExists('sessions');
};

exports.down = () => {
};
