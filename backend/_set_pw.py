from neo4j import GraphDatabase

d = GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "neo4j"))
with d.session(database="system") as s:
    s.run("ALTER CURRENT USER SET PASSWORD FROM 'neo4j' TO 'hackathon123'")
    print("Password changed to hackathon123")
d.close()

d2 = GraphDatabase.driver("bolt://127.0.0.1:7687", auth=("neo4j", "hackathon123"))
d2.verify_connectivity()
print("Verified: connected with new password!")
d2.close()
