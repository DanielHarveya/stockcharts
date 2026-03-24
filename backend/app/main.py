from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.routes.database_routes import router as database_router
from app.routes.instrument_routes import router as instrument_router
from app.routes.strategy_routes import router as strategy_router
from app.routes.backtest_routes import router as backtest_router

app = FastAPI(title="Stock Strategy Backtester", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(database_router)
app.include_router(instrument_router)
app.include_router(strategy_router)
app.include_router(backtest_router)


@app.on_event("startup")
async def startup_event():
    pass


@app.get("/")
async def root():
    return {"message": "Stock Strategy Backtester API", "version": "1.0.0"}
