const sql = require('mssql');

async function checkdb(paramProfile) {
  try {
    // config for your database
    const config = {
      user: paramProfile.flywayDatabaseUsername,
      password: paramProfile.flywayDatabasePassword,
      server: paramProfile.flywayDatabaseServer,
      database: paramProfile.flywayDatabaseName,
      trustServerCertificate: true,
    };
    await sql.connect(config);
    await sql.query`select count(0) from cmfcase`;
    return true;
  } catch (err) {
    return false;
  }
}
module.exports = {
  checkdb,
};
