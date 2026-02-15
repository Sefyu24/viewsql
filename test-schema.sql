-- ============================================
-- ViewSQL Test Schema — E-commerce Database
-- ============================================
-- Paste this DDL when creating a new project.

CREATE TABLE customers (
  id SERIAL PRIMARY KEY,
  email VARCHAR(255) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  tier VARCHAR(20) DEFAULT 'free',
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  parent_id INTEGER REFERENCES categories(id)
);

CREATE TABLE products (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  category_id INTEGER NOT NULL REFERENCES categories(id),
  price DECIMAL(10, 2) NOT NULL,
  stock INTEGER DEFAULT 0,
  active BOOLEAN DEFAULT true
);

CREATE TABLE orders (
  id SERIAL PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  status VARCHAR(20) DEFAULT 'pending',
  total DECIMAL(10, 2) NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE order_items (
  id SERIAL PRIMARY KEY,
  order_id INTEGER NOT NULL REFERENCES orders(id),
  product_id INTEGER NOT NULL REFERENCES products(id),
  quantity INTEGER NOT NULL,
  unit_price DECIMAL(10, 2) NOT NULL
);

CREATE TABLE reviews (
  id SERIAL PRIMARY KEY,
  product_id INTEGER NOT NULL REFERENCES products(id),
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 5),
  comment TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);


-- ============================================
-- Test Queries
-- ============================================
-- Copy these one at a time into the SQL editor.

-- 1. Simple SELECT (single table, filter)
its 

-- 2. Two-table JOIN
SELECT c.name, o.id AS order_id, o.total, o.status
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
WHERE o.status = 'completed';

-- 3. Three-table JOIN chain
SELECT c.name AS customer, p.name AS product, oi.quantity, oi.unit_price
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
INNER JOIN order_items oi ON o.id = oi.order_id
INNER JOIN products p ON oi.product_id = p.id;

-- 4. GROUP BY with aggregates
SELECT c.name, COUNT(o.id) AS order_count, SUM(o.total) AS total_spent
FROM customers c
INNER JOIN orders o ON c.id = o.customer_id
GROUP BY c.name;

-- 5. LEFT JOIN (find customers with no orders)
SELECT c.name, c.email, o.id AS order_id
FROM customers c
LEFT JOIN orders o ON c.id = o.customer_id
WHERE o.id IS NULL;

-- 6. CTE — top spenders
WITH customer_totals AS (
  SELECT customer_id, SUM(total) AS lifetime_spend
  FROM orders
  WHERE status = 'completed'
  GROUP BY customer_id
)
SELECT c.name, c.email, ct.lifetime_spend
FROM customer_totals ct
INNER JOIN customers c ON ct.customer_id = c.id
WHERE ct.lifetime_spend > 100;

-- 7. Multiple CTEs — product performance
WITH product_sales AS (
  SELECT oi.product_id, SUM(oi.quantity) AS units_sold, SUM(oi.quantity * oi.unit_price) AS revenue
  FROM order_items oi
  INNER JOIN orders o ON oi.order_id = o.id
  WHERE o.status = 'completed'
  GROUP BY oi.product_id
),
product_ratings AS (
  SELECT product_id, AVG(rating) AS avg_rating, COUNT(*) AS review_count
  FROM reviews
  GROUP BY product_id
)
SELECT p.name, cat.name AS category, ps.units_sold, ps.revenue, pr.avg_rating, pr.review_count
FROM products p
INNER JOIN categories cat ON p.category_id = cat.id
LEFT JOIN product_sales ps ON p.id = ps.product_id
LEFT JOIN product_ratings pr ON p.id = pr.product_id;

-- 8. Self-join (category hierarchy)
SELECT child.name AS subcategory, parent.name AS parent_category
FROM categories child
INNER JOIN categories parent ON child.parent_id = parent.id;
