import io
from typing import Optional

from sqlalchemy import create_engine, text
from sqlalchemy.engine import Engine
from sqlalchemy.orm import sessionmaker, Session

from app.config import get_config

_engine: Optional[Engine] = None
_session_factory: Optional[sessionmaker] = None
_ssh_tunnel = None


def _start_ssh_tunnel():
    """Start an SSH tunnel to the database if SSH is enabled."""
    global _ssh_tunnel
    config = get_config()

    if _ssh_tunnel is not None:
        try:
            _ssh_tunnel.close()
        except Exception:
            pass
        _ssh_tunnel = None

    if not config.ssh_enabled:
        return None

    from sshtunnel import SSHTunnelForwarder
    import paramiko

    ssh_kwargs = {
        "ssh_address_or_host": (config.ssh_host, config.ssh_port),
        "ssh_username": config.ssh_user,
        "remote_bind_address": (config.db_host, config.db_port),
    }

    if config.ssh_private_key:
        pkey = paramiko.RSAKey.from_private_key(io.StringIO(config.ssh_private_key))
        ssh_kwargs["ssh_pkey"] = pkey
    elif config.ssh_password:
        ssh_kwargs["ssh_password"] = config.ssh_password

    _ssh_tunnel = SSHTunnelForwarder(**ssh_kwargs)
    _ssh_tunnel.start()
    return _ssh_tunnel


def _get_connection_string() -> str:
    """Build the connection string, using the SSH tunnel's local port if active."""
    config = get_config()
    if _ssh_tunnel and _ssh_tunnel.is_active:
        return (
            f"postgresql://{config.db_user}:{config.db_password}"
            f"@127.0.0.1:{_ssh_tunnel.local_bind_port}/{config.db_name}"
        )
    return config.connection_string


def get_engine() -> Engine:
    """Create or return the SQLAlchemy engine based on current config."""
    global _engine
    config = get_config()
    if not config.is_db_configured:
        raise RuntimeError("Database is not configured. Please set connection parameters first.")

    if config.ssh_enabled:
        _start_ssh_tunnel()

    connection_string = _get_connection_string()
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
    """Reset the engine and close any SSH tunnel."""
    global _engine, _session_factory, _ssh_tunnel
    if _engine is not None:
        _engine.dispose()
    _engine = None
    _session_factory = None
    if _ssh_tunnel is not None:
        try:
            _ssh_tunnel.close()
        except Exception:
            pass
        _ssh_tunnel = None
