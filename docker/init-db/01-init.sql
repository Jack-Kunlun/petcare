-- PetCare 数据库初始化脚本
-- 此脚本会在PostgreSQL容器首次启动时自动执行

-- 创建扩展（如果需要）
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 这里可以添加其他初始化SQL语句
-- 例如：创建额外的schema、设置权限等
