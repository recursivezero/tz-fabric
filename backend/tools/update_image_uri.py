import lancedb

from image_search.schema import Fabric

DB_PATH = "database"
TABLE_NAME = "tz-fabric-table"
NEW_TABLE_NAME = "tz-fabric-table-v2"

OLD_DOMAIN = "threadzip-bucket.s3.amazonaws.com"
NEW_DOMAIN = "assets.threadzip.com"


def main():
    db = lancedb.connect(DB_PATH)

    # Remove existing table if it already exists
    if NEW_TABLE_NAME in db.table_names():
        print(f"Dropping existing table '{NEW_TABLE_NAME}'...")
        db.drop_table(NEW_TABLE_NAME)

    table = db.open_table(TABLE_NAME)

    print(f"Reading {table.count_rows()} rows...")

    rows = table.search().limit(table.count_rows()).to_list()

    updated = 0

    for row in rows:
        old = row["image_uri"]
        new = old.replace(OLD_DOMAIN, NEW_DOMAIN, 1)

        if old != new:
            row["image_uri"] = new
            updated += 1

    print(f"Updated {updated} URLs")

    print("Creating new table with Fabric schema...")

    db.create_table(
        NEW_TABLE_NAME,
        data=rows,
        schema=Fabric,
        mode="overwrite",
    )

    print("Done.")

    new_table = db.open_table(NEW_TABLE_NAME)

    print("\nMetadata:")
    print(new_table.schema.metadata)

    print("\nSearch builder:")
    print(new_table.search("shirt"))


if __name__ == "__main__":
    main()
