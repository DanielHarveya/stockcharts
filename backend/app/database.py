from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import get_config

_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker] = None


def get_engine() -> Engine:
    """Create or return the SQLAlchemy engine based on current config."""
    global _engine
    config = get_config()
    if not config.is_db_configured:
        raise RuntimeError("Database is not configured. Please set connection parameters first.")
    connection_string = config.connection_string
    if _engine is None or str(_engine.url) != connection_string:
        _engine = create_engine(connection_string, pool_pre_ping=True, pool_size=5, max_overflow=10)
    return _engine


def get_session_factory() -> sessionmaker:
    """Return a sessionmaker bound to the current engine."""
    global _session_factory
    engine = get_engine()
    if _session_factory is None or _session_factory.kw.get("bind") is not engine:
        _session_factory = sessionmaker(bind=engine)
    return _session_factory


def get_session() -> Session:
    """Get a new database session."""
    factory = get_session_factory()
    return factory()


def test_connection() -> bool:
    """Test the database connection. Returns True on success, raises on failure."""
    engine = get_engine()
    with engine.connect() as conn:
        conn.execute(text("SELECT 1"))
    return True


def reset_engine() -> None:
    """Reset the engine (used when connection settings change)."""
    global _engine, _session_factory
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
