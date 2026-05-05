from dotenv import load_dotenv
from pydantic import BaseModel, Field
import os


load_dotenv()


class Settings(BaseModel):
    private_key: str = Field(default_factory=lambda: os.getenv('PRIVATE_KEY', ''))
    alchemy_amoy_url: str = Field(default_factory=lambda: os.getenv('ALCHEMY_AMOY_URL', ''))
    contract_address: str = Field(default_factory=lambda: os.getenv('CONTRACT_ADDRESS', ''))
    pinata_api_key: str = Field(default_factory=lambda: os.getenv('PINATA_API_KEY', ''))
    pinata_secret_key: str = Field(default_factory=lambda: os.getenv('PINATA_SECRET_KEY', ''))
    mongo_uri: str = Field(default_factory=lambda: os.getenv('MONGO_URI', ''))


settings = Settings()
