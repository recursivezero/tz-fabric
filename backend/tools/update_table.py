import lancedb

from image_search.schema import Fabric

DB_PATH = "database"
TABLE_NAME = "tz-fabric-table"

OLD_DOMAIN = "threadzip-bucket.s3.amazonaws.com"
NEW_DOMAIN = "assets.threadzip.com"


def main():
    db = lancedb.connect(DB_PATH)

    # Read the existing table before dropping it
    old_table = db.open_table(TABLE_NAME)

    print(f"Reading {old_table.count_rows()} rows...")

    rows = old_table.search().limit(old_table.count_rows()).to_list()

    updated = 0

    for row in rows:
        old = row["image_uri"]
        new = old.replace(OLD_DOMAIN, NEW_DOMAIN, 1)

        if old != new:
            row["image_uri"] = new
            updated += 1

    print(f"Updated {updated} URLs")

    print(f"Dropping '{TABLE_NAME}'...")
    db.drop_table(TABLE_NAME)

    print(f"Creating '{TABLE_NAME}' with Fabric schema...")

    db.create_table(
        TABLE_NAME,
        data=rows,
        schema=Fabric,
    )

    table = db.open_table(TABLE_NAME)

    print("\nMetadata:")
    print(table.schema.metadata)

    print("\nSearch builder:")
    print(table.search("shirt"))

    print("\nMigration completed successfully.")


if __name__ == "__main__":
    main()