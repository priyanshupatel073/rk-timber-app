-- Database schema for RK Timber App
CREATE DATABASE IF NOT EXISTS `rk_timber_db` DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `rk_timber_db`;

-- Table for customer records
CREATE TABLE IF NOT EXISTS `customers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(150) NOT NULL,
  `phone` VARCHAR(30) DEFAULT NULL,
  `address` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for predefined wood types and default rates
CREATE TABLE IF NOT EXISTS `wood_types` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `name` VARCHAR(100) NOT NULL,
  `default_rate_per_cft` DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  `category` VARCHAR(50) DEFAULT 'General Wood',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed default wood types
INSERT INTO `wood_types` (`name`, `default_rate_per_cft`, `category`) VALUES
('Teak (Sagwan)', 2200.00, 'Hardwood'),
('Sal Wood', 1400.00, 'Hardwood'),
('Sheesham', 1800.00, 'Hardwood'),
('Marandi / White Cedar', 950.00, 'Softwood'),
('Pine Wood', 750.00, 'Softwood'),
('Plywood (Commercial)', 65.00, 'Board/Sheet'),
('Flush Door Core', 850.00, 'Engineered Wood')
ON DUPLICATE KEY UPDATE `name`=`name`;

-- Table for orders / bills
CREATE TABLE IF NOT EXISTS `orders` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `bill_no` VARCHAR(50) NOT NULL UNIQUE,
  `customer_name` VARCHAR(150) NOT NULL,
  `customer_phone` VARCHAR(30) DEFAULT NULL,
  `customer_address` TEXT DEFAULT NULL,
  `order_date` DATE NOT NULL,
  `total_cft` DECIMAL(10,3) NOT NULL DEFAULT 0.000,
  `subtotal` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `cutting_charges` DECIMAL(10,2) DEFAULT 0.00,
  `transport_charges` DECIMAL(10,2) DEFAULT 0.00,
  `tax_percent` DECIMAL(5,2) DEFAULT 0.00,
  `discount` DECIMAL(10,2) DEFAULT 0.00,
  `grand_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `notes` TEXT DEFAULT NULL,
  `payment_status` ENUM('Pending', 'Paid', 'Partial') DEFAULT 'Pending',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for order itemized wood sizes
CREATE TABLE IF NOT EXISTS `order_items` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `order_id` INT NOT NULL,
  `wood_type` VARCHAR(100) NOT NULL,
  `length_ft` DECIMAL(8,2) NOT NULL,
  `width_in` DECIMAL(8,2) NOT NULL,
  `thickness_in` DECIMAL(8,2) NOT NULL,
  `pcs` INT NOT NULL DEFAULT 1,
  `cft_per_pc` DECIMAL(10,4) NOT NULL,
  `total_cft` DECIMAL(10,4) NOT NULL,
  `rate_per_cft` DECIMAL(10,2) NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  FOREIGN KEY (`order_id`) REFERENCES `orders`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Table for Daily Retail & Cash Flow Roznamcha (Debit & Credit Ledger)
CREATE TABLE IF NOT EXISTS `daily_retail` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `entry_date` DATE NOT NULL UNIQUE,
  `debit_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `credit_total` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `sub_amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00,
  `debit_entries` LONGTEXT DEFAULT NULL,
  `credit_entries` LONGTEXT DEFAULT NULL,
  `notes` TEXT DEFAULT NULL,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
