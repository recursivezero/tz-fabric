import lancedb


from constants import DATABASE_PATH


def delete_all_tables(db_path: str):
    """
    Deletes all tables in a LanceDB database at the specified path.

    Args:
        db_path (str): Path to the LanceDB database directory
    """
    # Connect to the LanceDB database
    db = lancedb.connect(db_path)

    # Get list of all table names
    table_names = db.table_names()

    if not table_names:
        print("No tables found in the database.")
        return

    print(f"Found {len(table_names)} tables in the database:")
    for name in table_names:
        print(f" - {name}")

    # Confirm deletion with user
    confirm = input(
        "\nAre you sure you want to delete ALL tables? This cannot be undone. (y/n): "
    )
    if confirm.lower() != "y":
        print("Operation cancelled.")
        return

    # Delete each table
    for name in table_names:
        try:
            db.drop_table(name)
            print(f"Successfully deleted table: {name}")
        except Exception as e:
            print(f"Error deleting table {name}: {str(e)}")

    print("\nAll tables have been deleted.")


if __name__ == "__main__":
    # Replace with your LanceDB database path
    database_path = DATABASE_PATH  # e.g., "./lancedb_data"

    delete_all_tables(database_path)
