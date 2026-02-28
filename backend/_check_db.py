from neo4j import GraphDatabase

d = GraphDatabase.driver("neo4j://127.0.0.1:7687", auth=("neo4j", "hackathon1234"))
with d.session() as s:
    r = s.run("MATCH (n) RETURN labels(n)[0] AS type, count(n) AS count ORDER BY type")
    print("=== Node counts in Neo4j ===")
    for rec in r:
        print(f"  {rec['type']}: {rec['count']}")

    print()
    r2 = s.run("MATCH (doc:Document) RETURN doc.id AS id")
    print("=== Documents stored ===")
    for rec in r2:
        print(f"  {rec['id']}")

    print()
    r3 = s.run("MATCH (w:Word) RETURN w.normalized AS word ORDER BY word LIMIT 20")
    print("=== Sample words (first 20) ===")
    for rec in r3:
        print(f"  {rec['word']}")

    print()
    r4 = s.run("MATCH ()-[r]->() RETURN type(r) AS rel, count(r) AS count ORDER BY rel")
    print("=== Relationships ===")
    for rec in r4:
        print(f"  {rec['rel']}: {rec['count']}")

d.close()
