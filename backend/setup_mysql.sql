-- MySQL 8.0+ Setup Script for IQAC PMS
-- Run as root: mysql -u root -p < setup_mysql.sql

-- Create database with proper charset
CREATE DATABASE IF NOT EXISTS `iqac_pms`
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

-- Create dedicated user
CREATE USER IF NOT EXISTS 'iqac_user'@'localhost' IDENTIFIED BY 'your-strong-password';
CREATE USER IF NOT EXISTS 'iqac_user'@'%' IDENTIFIED BY 'your-strong-password';

-- Grant privileges
GRANT ALL PRIVILEGES ON `iqac_pms`.* TO 'iqac_user'@'localhost';
GRANT ALL PRIVILEGES ON `iqac_pms`.* TO 'iqac_user'@'%';
FLUSH PRIVILEGES;

-- Verify
SHOW DATABASES LIKE 'iqac_pms';
SHOW GRANTS FOR 'iqac_user'@'localhost';

-- Recommended MySQL settings (add to my.cnf / my.ini)
-- [mysqld]
-- default_authentication_plugin=mysql_native_password
-- innodb_strict_mode=ON
-- sql_mode=STRICT_TRANS_TABLES,NO_ZERO_DATE,NO_ZERO_IN_DATE,ERROR_FOR_DIVISION_BY_ZERO
-- character_set_server=utf8mb4
-- collation_server=utf8mb4_unicode_ci
-- max_allowed_packet=64M
-- innodb_buffer_pool_size=1G  # Adjust based on RAM