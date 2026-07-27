import lancedb

db = lancedb.connect("database")
table = db.open_table("tz-fabric-table-v2")

# for row in table.search().limit(3).to_list():
#     print(row["image_uri"])



print("OLD METADATA")
print(db.open_table("tz-fabric-table").schema.metadata)

print("\nNEW METADATA")
print(db.open_table("tz-fabric-table-v2").schema.metadata)