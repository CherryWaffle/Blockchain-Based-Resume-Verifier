from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .routers.candidate import router as candidate_router
from .routers.issuer import router as issuer_router
from .routers.verify import router as verify_router

app = FastAPI(title='Blockchain Resume Verifier', version='1.0.0')

app.add_middleware(
    CORSMiddleware,
    allow_origins=['*'],
    allow_credentials=True,
    allow_methods=['*'],
    allow_headers=['*'],
)

app.include_router(issuer_router, prefix='/issuer', tags=['issuer'])
app.include_router(candidate_router, prefix='/candidate', tags=['candidate'])
app.include_router(verify_router, prefix='/verify', tags=['verify'])


@app.get('/health')
def health_check():
    return {'status': 'ok'}
