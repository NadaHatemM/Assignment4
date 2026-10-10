-- Question 14
CREATE USER 'store_manager'@'localhost'
IDENTIFIED BY 'ChangeThis_Store2026!';

GRANT SELECT, INSERT, UPDATE
ON retail_store.*
TO 'store_manager'@'localhost';

SHOW GRANTS FOR 'store_manager'@'localhost';

-- Question 15
REVOKE UPDATE
ON retail_store.*
FROM 'store_manager'@'localhost';

SHOW GRANTS FOR 'store_manager'@'localhost';

-- Question 16
GRANT DELETE
ON retail_store.Sales
TO 'store_manager'@'localhost';

SHOW GRANTS FOR 'store_manager'@'localhost';