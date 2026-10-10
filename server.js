const express = require("express");
const { pool, setupDatabase } = require("./db");

const app = express();

app.use(express.json());

// ---------- Helpers ----------

function error(status, message) {
  const err = new Error(message);
  err.status = status;
  throw err;
}

function getId(value) {
  const id = Number(value);

  if (
    !/^\d+$/.test(String(value)) ||
    !Number.isInteger(id) ||
    id < 1 ||
    id > 2147483647
  ) {
    error(400, "ID must be a positive integer.");
  }

  return id;
}

function checkText(value, name, maxLength) {
  if (typeof value !== "string" || !value.trim() || value.length > maxLength) {
    error(
      400,
      `${name} is required and must not exceed ${maxLength} characters.`,
    );
  }
}

function checkProduct(body) {
  checkText(body.ProductName, "ProductName", 100);

  if (
    typeof body.Price !== "number" ||
    !Number.isFinite(body.Price) ||
    body.Price < 0 ||
    body.Price > 99999999.99 ||
    Number(body.Price.toFixed(2)) !== body.Price
  ) {
    error(400, "Enter a valid price with at most 2 decimal places.");
  }

  if (
    !Number.isInteger(body.StockQuantity) ||
    body.StockQuantity < 0 ||
    body.StockQuantity > 2147483647
  ) {
    error(400, "StockQuantity must be a nonnegative integer.");
  }

  getId(body.SupplierID);
}

async function checkSupplier(body) {
  checkText(body.SupplierName, "SupplierName", 100);

  const [columns] = await pool.query(`
    SELECT CHARACTER_MAXIMUM_LENGTH AS maxLength
    FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = 'Suppliers'
      AND COLUMN_NAME = 'ContactNumber'
  `);

  checkText(body.ContactNumber, "ContactNumber", Number(columns[0].maxLength));
}

function checkDate(value) {
  if (
    typeof value !== "string" ||
    !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
    value < "1000-01-01" ||
    value > "9999-12-31"
  ) {
    error(400, "Enter SaleDate in YYYY-MM-DD format.");
  }

  const date = new Date(`${value}T00:00:00Z`);

  if (
    Number.isNaN(date.getTime()) ||
    date.toISOString().slice(0, 10) !== value
  ) {
    error(400, "Enter a real calendar date.");
  }
}

// ---------- Basic routes ----------

app.get("/", (req, res) => {
  res.json({ message: "Server is working" });
});

app.get("/tables", async (req, res) => {
  const [tables] = await pool.query("SHOW TABLES");
  res.json(tables);
});

// ---------- Question 2: Products CRUD ----------

// Create a product.
app.post("/products", async (req, res) => {
  const body = req.body || {};

  checkProduct(body);

  const { ProductName, Price, StockQuantity, SupplierID } = body;

  const [result] = await pool.execute(
    `INSERT INTO Products
     (ProductName, Price, StockQuantity, SupplierID)
     VALUES (?, ?, ?, ?)`,
    [ProductName, Price, StockQuantity, SupplierID],
  );

  res.status(201).json({
    message: "Product added",
    ProductID: result.insertId,
  });
});

// Get all products.
app.get("/products", async (req, res) => {
  const [products] = await pool.query(
    "SELECT * FROM Products ORDER BY ProductID",
  );

  res.json(products);
});

// Get a product by ID.
app.get("/products/:id", async (req, res) => {
  const id = getId(req.params.id);

  const [products] = await pool.execute(
    "SELECT * FROM Products WHERE ProductID = ?",
    [id],
  );

  if (products.length === 0) {
    error(404, "Product not found.");
  }

  res.json(products[0]);
});

// Update a product.
// Send all four editable fields.
app.put("/products/:id", async (req, res) => {
  const id = getId(req.params.id);
  const body = req.body || {};

  checkProduct(body);

  const { ProductName, Price, StockQuantity, SupplierID } = body;

  const [result] = await pool.execute(
    `UPDATE Products
     SET ProductName = ?,
         Price = ?,
         StockQuantity = ?,
         SupplierID = ?
     WHERE ProductID = ?`,
    [ProductName, Price, StockQuantity, SupplierID, id],
  );

  if (result.affectedRows === 0) {
    error(404, "Product not found.");
  }

  res.json({ message: "Product updated" });
});

// Delete a product.
app.delete("/products/:id", async (req, res) => {
  const id = getId(req.params.id);

  const [result] = await pool.execute(
    "DELETE FROM Products WHERE ProductID = ?",
    [id],
  );

  if (result.affectedRows === 0) {
    error(404, "Product not found.");
  }

  res.json({ message: "Product deleted" });
});

// ---------- Question 3: Suppliers CRUD ----------

// Create a supplier.
app.post("/suppliers", async (req, res) => {
  const body = req.body || {};

  await checkSupplier(body);

  const { SupplierName, ContactNumber } = body;

  const [result] = await pool.execute(
    `INSERT INTO Suppliers
     (SupplierName, ContactNumber)
     VALUES (?, ?)`,
    [SupplierName, ContactNumber],
  );

  res.status(201).json({
    message: "Supplier added",
    SupplierID: result.insertId,
  });
});

// Get all suppliers.
app.get("/suppliers", async (req, res) => {
  const [suppliers] = await pool.query(
    "SELECT * FROM Suppliers ORDER BY SupplierID",
  );

  res.json(suppliers);
});

// Update a supplier.
app.put("/suppliers/:id", async (req, res) => {
  const id = getId(req.params.id);
  const body = req.body || {};

  await checkSupplier(body);

  const { SupplierName, ContactNumber } = body;

  const [result] = await pool.execute(
    `UPDATE Suppliers
     SET SupplierName = ?, ContactNumber = ?
     WHERE SupplierID = ?`,
    [SupplierName, ContactNumber, id],
  );

  if (result.affectedRows === 0) {
    error(404, "Supplier not found.");
  }

  res.json({ message: "Supplier updated" });
});

// Delete a supplier.
app.delete("/suppliers/:id", async (req, res) => {
  const id = getId(req.params.id);

  const [result] = await pool.execute(
    "DELETE FROM Suppliers WHERE SupplierID = ?",
    [id],
  );

  if (result.affectedRows === 0) {
    error(404, "Supplier not found.");
  }

  res.json({ message: "Supplier deleted" });
});

// ---------- Question 4: Sales ----------

// Record a sale.
app.post("/sales", async (req, res) => {
  const body = req.body || {};

  const ProductID = getId(body.ProductID);
  const { QuantitySold, SaleDate } = body;

  if (
    !Number.isInteger(QuantitySold) ||
    QuantitySold < 1 ||
    QuantitySold > 2147483647
  ) {
    error(400, "QuantitySold must be a positive integer.");
  }

  checkDate(SaleDate);

  const [result] = await pool.execute(
    `INSERT INTO Sales
     (ProductID, QuantitySold, SaleDate)
     VALUES (?, ?, ?)`,
    [ProductID, QuantitySold, SaleDate],
  );

  res.status(201).json({
    message: "Sale recorded",
    SaleID: result.insertId,
  });
});

// Get all sales.
app.get("/sales", async (req, res) => {
  const [sales] = await pool.query("SELECT * FROM Sales ORDER BY SaleID");

  res.json(sales);
});

// Get sales for a specific product.
app.get("/sales/product/:id", async (req, res) => {
  const id = getId(req.params.id);

  const [products] = await pool.execute(
    "SELECT ProductID FROM Products WHERE ProductID = ?",
    [id],
  );

  if (products.length === 0) {
    error(404, "Product not found.");
  }

  const [sales] = await pool.execute(
    "SELECT * FROM Sales WHERE ProductID = ? ORDER BY SaleID",
    [id],
  );

  res.json(sales);
});

// ---------- Question 5: Table modifications ----------

// Add Category.
app.post("/schema/category", async (req, res) => {
  await pool.query("ALTER TABLE Products ADD COLUMN Category VARCHAR(100)");

  res.json({ message: "Category added" });
});

// Remove Category.
app.delete("/schema/category", async (req, res) => {
  await pool.query("ALTER TABLE Products DROP COLUMN Category");

  res.json({ message: "Category removed" });
});

// Change ContactNumber to VARCHAR(15).
app.patch("/schema/contact-number", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT SupplierID
    FROM Suppliers
    WHERE CHAR_LENGTH(ContactNumber) > 15
    LIMIT 1
  `);

  if (rows.length > 0) {
    error(409, "Shorten existing contact numbers to 15 characters first.");
  }

  await pool.query(`
    ALTER TABLE Suppliers
    MODIFY COLUMN ContactNumber VARCHAR(15)
  `);

  res.json({ message: "ContactNumber changed to VARCHAR(15)" });
});

// Add NOT NULL to ProductName.
app.patch("/schema/product-name", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT ProductID
    FROM Products
    WHERE ProductName IS NULL
    LIMIT 1
  `);

  if (rows.length > 0) {
    error(409, "Give existing unnamed products a name first.");
  }

  await pool.query(`
    ALTER TABLE Products
    MODIFY COLUMN ProductName VARCHAR(100) NOT NULL
  `);

  res.json({ message: "ProductName is now NOT NULL" });
});

// ---------- Question 6: Required sample data ----------

// Run this while Products and Sales are empty.
// Reuses FreshFoods if you already added that supplier.
app.post("/seed", async (req, res) => {
  const connection = await pool.getConnection();
  let locked = false;

  try {
    const [lock] = await connection.query(
      "SELECT GET_LOCK('retail_store_seed', 5) AS acquired",
    );

    if (Number(lock[0].acquired) !== 1) {
      error(409, "Sample data is being added. Try again.");
    }

    locked = true;

    await connection.beginTransaction();

    const [counts] = await connection.query(`
      SELECT
        (SELECT COUNT(*) FROM Products) +
        (SELECT COUNT(*) FROM Sales) AS total
    `);

    if (Number(counts[0].total) > 0) {
      error(409, "Products and Sales must be empty before adding sample data.");
    }

    const [suppliers] = await connection.execute(
      `SELECT SupplierID
       FROM Suppliers
       WHERE SupplierName = ?
         AND ContactNumber = ?
       ORDER BY SupplierID
       LIMIT 1`,
      ["FreshFoods", "01001234567"],
    );

    let supplierId;

    if (suppliers.length > 0) {
      supplierId = suppliers[0].SupplierID;
    } else {
      const [supplier] = await connection.execute(
        `INSERT INTO Suppliers
         (SupplierName, ContactNumber)
         VALUES (?, ?)`,
        ["FreshFoods", "01001234567"],
      );

      supplierId = supplier.insertId;
    }

    const sampleProducts = [
      ["Milk", 15, 50],
      ["Bread", 10, 30],
      ["Eggs", 20, 40],
    ];

    const productIds = {};

    for (const [name, price, stock] of sampleProducts) {
      const [product] = await connection.execute(
        `INSERT INTO Products
         (ProductName, Price, StockQuantity, SupplierID)
         VALUES (?, ?, ?, ?)`,
        [name, price, stock, supplierId],
      );

      productIds[name] = product.insertId;
    }

    const [sale] = await connection.execute(
      `INSERT INTO Sales
       (ProductID, QuantitySold, SaleDate)
       VALUES (?, ?, ?)`,
      [productIds.Milk, 2, "2025-05-20"],
    );

    await connection.commit();

    res.status(201).json({
      message: "Sample data added",
      SupplierID: supplierId,
      productIds,
      SaleID: sale.insertId,
    });
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    try {
      if (locked) {
        await connection.query("SELECT RELEASE_LOCK('retail_store_seed')");
      }
    } finally {
      connection.release();
    }
  }
});

// ---------- Question 7: Update Bread price ----------

app.patch("/actions/bread-price", async (req, res) => {
  const [result] = await pool.execute(
    "UPDATE Products SET Price = ? WHERE ProductName = ?",
    [25, "Bread"],
  );

  if (result.affectedRows === 0) {
    error(404, "Bread not found.");
  }

  res.json({ message: "Bread price updated to 25.00" });
});

// ---------- Question 8: Delete Eggs ----------

app.delete("/actions/eggs", async (req, res) => {
  const [result] = await pool.execute(
    "DELETE FROM Products WHERE ProductName = ?",
    ["Eggs"],
  );

  if (result.affectedRows === 0) {
    error(404, "Eggs not found.");
  }

  res.json({ message: "Eggs deleted" });
});

// ---------- Question 9: Total quantity sold ----------

app.get("/reports/total-sold", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      p.ProductID,
      p.ProductName,
      COALESCE(SUM(s.QuantitySold), 0) AS TotalQuantitySold
    FROM Products p
    LEFT JOIN Sales s
      ON p.ProductID = s.ProductID
    GROUP BY p.ProductID, p.ProductName
    ORDER BY p.ProductID
  `);

  res.json(rows);
});

// ---------- Question 10: Highest stock ----------

app.get("/reports/highest-stock", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT *
    FROM Products
    ORDER BY StockQuantity DESC, ProductID ASC
    LIMIT 1
  `);

  if (rows.length === 0) {
    error(404, "There are no products.");
  }

  res.json(rows[0]);
});

// ---------- Question 11: Suppliers starting with F ----------

app.get("/reports/suppliers-f", async (req, res) => {
  const [rows] = await pool.execute(
    "SELECT * FROM Suppliers WHERE SupplierName LIKE ?",
    ["F%"],
  );

  res.json(rows);
});

// ---------- Question 12: Products never sold ----------

app.get("/reports/never-sold", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT p.*
    FROM Products p
    WHERE NOT EXISTS (
      SELECT 1
      FROM Sales s
      WHERE s.ProductID = p.ProductID
    )
    ORDER BY p.ProductID
  `);

  res.json(rows);
});

// ---------- Question 13: Sales details using JOIN ----------

app.get("/reports/sales-details", async (req, res) => {
  const [rows] = await pool.query(`
    SELECT
      p.ProductName,
      s.QuantitySold,
      s.SaleDate
    FROM Sales s
    INNER JOIN Products p
      ON s.ProductID = p.ProductID
    ORDER BY s.SaleID
  `);

  res.json(rows);
});

// ---------- Unknown routes ----------

app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// ---------- Error handling ----------

// Express 5 sends async route errors here.
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed") {
    return res.status(400).json({
      message: "Invalid JSON body.",
    });
  }

  if (err.status) {
    return res.status(err.status).json({
      message: err.message,
    });
  }

  if (err.code === "ER_NO_REFERENCED_ROW_2") {
    return res.status(400).json({
      message: "The supplier or product does not exist.",
    });
  }

  if (err.code === "ER_ROW_IS_REFERENCED_2") {
    return res.status(409).json({
      message: "Cannot delete this record because another table uses it.",
    });
  }

  if (err.code === "ER_DUP_FIELDNAME") {
    return res.status(409).json({
      message: "Category already exists.",
    });
  }

  if (err.code === "ER_CANT_DROP_FIELD_OR_KEY") {
    return res.status(409).json({
      message: "Category does not exist.",
    });
  }

  if (err.code === "ER_DATA_TOO_LONG" || err.code === "ER_BAD_NULL_ERROR") {
    return res.status(400).json({
      message: "Check the values and required fields.",
    });
  }

  console.error(err);

  res.status(500).json({
    message: "Something went wrong. Check the terminal.",
  });
});

// ---------- Start the server ----------

async function startServer() {
  try {
    await setupDatabase();

    const server = app.listen(3000, "127.0.0.1", () => {
      console.log("Database and tables are ready");
      console.log("Server running on http://localhost:3000");
    });

    server.on("error", async (err) => {
      console.log("Could not start:", err.message);
      await pool.end();
      process.exitCode = 1;
    });
  } catch (err) {
    console.log("Could not start:", err.message);
    await pool.end();
    process.exitCode = 1;
  }
}

startServer();
