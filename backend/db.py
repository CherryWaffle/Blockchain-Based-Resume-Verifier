from pymongo import MongoClient

from .config import settings


_client = None


def get_database():
    global _client
    if not settings.mongo_uri:
        return None
    if _client is None:
        _client = MongoClient(settings.mongo_uri)
    return _client['blockchain_resume_verifier']


def save_credential_record(record):
    database = get_database()
    if database is None:
        return
    database.credentials.update_one(
        {'credential_id': record['credential_id']},
        {'$set': record},
        upsert=True,
    )


def save_verification_record(record):
    database = get_database()
    if database is None:
        return
    database.verifications.insert_one(record)
