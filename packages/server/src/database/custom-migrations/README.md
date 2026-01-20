# Custom RBAC Migrations

This directory contains custom database migrations.

## Structure

The migrations are organized by database type:
- `postgres/` - PostgreSQL migrations
- `mysql/` - MySQL migrations
- `mariadb/` - MariaDB migrations
- `sqlite/` - SQLite migrations

## How It Works

These custom migrations are automatically included in the main migration arrays for each database type. When the server initializes, TypeORM will run all migrations in order, including these custom RBAC migrations.

The migrations are integrated into the main migration system via the index files in `database/migrations/[db-type]/index.ts`, which import and spread the custom migrations at the end of the migration array.

## Adding New Migrations

When adding a new custom migration:

1. Create the migration file in all four database type folders with the same timestamp
2. Follow the naming convention: `{timestamp}-{MigrationName}.ts`
3. Export the migration class matching the pattern: `export class MigrationName{timestamp}`
4. Add the import and export to the corresponding `index.ts` file in each database folder
5. The migration will automatically be included when the server runs

## Current Migrations

- **1760000000001-AddPlatformAssetEntity.ts** - Creates the `platform_asset` table for storing platform-level assets like logos, favicons, and other customizable assets

## Notes

- All migrations must implement the TypeORM `MigrationInterface`
- Always provide both `up()` and `down()` methods
- Test migrations on all supported database types
- Use database-specific SQL syntax where necessary (e.g., uuid vs varchar for IDs)
