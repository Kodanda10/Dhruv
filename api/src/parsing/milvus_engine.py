from pymilvus import MilvusClient, DataType
import time

class MilvusEngine:
    def __init__(self, uri="http://localhost:19530", collection_name="project_dhruv"):
        retries = 3
        delay = 5  # seconds

        for i in range(retries):
            try:
                print(f"Attempting to connect to Milvus (attempt {i+1}/{retries})...")
                self.client = MilvusClient(uri=uri, timeout=10) # Added timeout
                print("Successfully connected to Milvus.")
                break  # Exit loop on success
            except Exception as e:
                print(f"Connection failed: {e}")
                if i < retries - 1:
                    print(f"Retrying in {delay} seconds...")
                    time.sleep(delay)
                else:
                    print("Max retries reached. Could not connect to Milvus.")
                    raise  # Re-raise the last exception

        self.collection_name = collection_name
        self.dim = 384 # Based on the sentence-transformer model we are using

    def create_collection_if_not_exists(self):
        if self.client.has_collection(collection_name=self.collection_name):
            print(f"Collection '{self.collection_name}' already exists. Skipping creation.")
            return

        print(f"Creating collection: {self.collection_name}")
        schema = self.client.create_schema(auto_id=False, enable_dynamic_field=False)
        schema.add_field(field_name="id", datatype=DataType.VARCHAR, max_length=100, is_primary=True)
        schema.add_field(field_name="document_text", datatype=DataType.VARCHAR, max_length=10000)
        schema.add_field(field_name="embedding", datatype=DataType.FLOAT_VECTOR, dim=self.dim)
        schema.add_field(field_name="genre", datatype=DataType.VARCHAR, max_length=100)
        schema.add_field(field_name="primary_genre", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="secondary_genre", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="character_role", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="character_type", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="theme_type", datatype=DataType.VARCHAR, max_length=50)
        schema.add_field(field_name="theme_setting", datatype=DataType.VARCHAR, max_length=50)

        self.client.create_collection(collection_name=self.collection_name, schema=schema)
        
        print("Creating vector index...")
        index_params = self.client.prepare_index_params()
        index_params.add_index(field_name="embedding", index_type="AUTOINDEX", metric_type="COSINE")
        self.client.create_index(collection_name=self.collection_name, index_params=index_params)
        print("Vector index created.")

    def insert(self, data: list[dict]):
        if not data:
            print("No data to insert.")
            return
        print(f"Inserting {len(data)} records...")
        res = self.client.insert(collection_name=self.collection_name, data=data)
        print("Insertion complete.")
        return res

    def search(self, query_embedding: list[float], filter_expression: str = "", limit: int = 5):
        print(f"Executing search with filter: '{filter_expression}'")
        results = self.client.search(
            collection_name=self.collection_name,
            data=[query_embedding],
            anns_field="embedding",
            limit=limit,
            filter=filter_expression,
            output_fields=["document_text", "genre", "primary_genre", "secondary_genre", "theme_type", "theme_setting"],
            search_params={"metric_type": "COSINE"},
        )
        return results

    def query(self, filter_expression: str, limit: int = 5):
        print(f"Executing query with filter: '{filter_expression}'")
        results = self.client.query(
            collection_name=self.collection_name,
            filter=filter_expression,
            output_fields=["document_text", "genre", "primary_genre", "secondary_genre"],
            limit=limit,
        )
        return results

    def load_collection(self):
        print("Loading collection into memory...")
        self.client.load_collection(collection_name=self.collection_name)
        print("Collection loaded.")