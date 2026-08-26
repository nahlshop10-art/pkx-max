-- Products Table
CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  data TEXT, -- JSON representation of the Product object
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_products_updated_at ON products(updated_at);

-- Orders Table
CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  type TEXT, -- "completed", "incomplete", "standard"
  data TEXT, -- JSON representation of the Order or IncompleteOrder object
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- D1 Performance Best Practices: Add indexes for frequently queried columns and JSON expressions
CREATE INDEX IF NOT EXISTS idx_orders_type ON orders(type);
CREATE INDEX IF NOT EXISTS idx_orders_phone ON orders(json_extract(data, '$.phone'));
CREATE INDEX IF NOT EXISTS idx_orders_updated_at ON orders(updated_at);
CREATE INDEX IF NOT EXISTS idx_orders_id_int ON orders(cast(id as integer));

-- Settings Table
CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT, -- JSON value for settings like marketing, courier, website, categories
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Customers Table
CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  data TEXT, -- JSON representation of the customer
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_customers_updated_at ON customers(updated_at);

-- Seed initial basic settings if not already present
INSERT OR IGNORE INTO settings (key, value) VALUES ('categories', '[]');
INSERT OR IGNORE INTO settings (key, value) VALUES ('websiteSettings', '{"bannerEnabled":true,"banners":[],"deliveryCharges":[{"id":"1","area":"Inside Dhaka","price":80,"time":"1/2 Days"},{"id":"2","area":"Outside Dhaka","price":110,"time":"2/3 Days"}],"productImageHover":true}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('marketingSettings', '{"metaPixel":{"enabled":false,"pixelId":"","accessToken":"","testCode":""},"tiktokPixel":{"enabled":false,"pixelId":"","accessToken":"","testCode":""}}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('courierSettings', '{"steadfast":{"apiKey":"","secretKey":""}}');
INSERT OR IGNORE INTO settings (key, value) VALUES ('priceCalculatorSettings', '{"yuanRate":18.35,"additionalCost":20,"profit":110}');

