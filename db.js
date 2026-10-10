require("dotenv").config({ quiet: true });

const mysql = require("mysql2/promise");

const settings = {
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  dateStrings: true,
};

const pool = mysql.createPool({
  ...settings,
  database: "retail_store",
  connectionLimit: 10,
});

async function setupDatabase() {
  const connection = await mysql.createConnection(settings);

  try {
    await connection.query("CREATE DATABASE IF NOT EXISTS retail_store");
  } finally {
    await connection.end();
  }

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Suppliers (
      SupplierID INT AUTO_INCREMENT PRIMARY KEY,
      SupplierName VARCHAR(100) NOT NULL,
      ContactNumber VARCHAR(30)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Products (
      ProductID INT AUTO_INCREMENT PRIMARY KEY,
      ProductName VARCHAR(100),
      Price DECIMAL(10,2) NOT NULL,
      StockQuantity INT NOT NULL,
      SupplierID INT NOT NULL,

      FOREIGN KEY (SupplierID)
        REFERENCES Suppliers(SupplierID)
    ) ENGINE=InnoDB
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS Sales (
      SaleID INT AUTO_INCREMENT PRIMARY KEY,
      ProductID INT NOT NULL,
      QuantitySold INT NOT NULL,
      SaleDate DATE NOT NULL,

      FOREIGN KEY (ProductID)
        REFERENCES Products(ProductID)
    ) ENGINE=InnoDB
  `);
}

module.exports = { pool, setupDatabase };
