from typing import Optional


class AppConfig:
    """Singleton configuration holder for database connection and column mappings."""

    _instance: Optional["AppConfig"] = None

    def __new__(cls) -> "AppConfig":
        if cls._instance is None:
            cls._instance = super().__new__(cls)
            cls._instance._initialized = False
        return cls._instance

    def __init__(self) -> None:
        if self._initialized:
            return
        self._initialized = True

        # Database connection settings
        self.db_host: Optional[str] = None
        self.db_port: int = 5432
        self.db_user: Optional[str] = None
        self.db_password: Optional[str] = None
        self.db_name: Optional[str] = None

        # OHLC table column mapping
        self.ohlc_table_name: Optional[str] = None
        self.ohlc_instrument_token_col: Optional[str] = None
        self.ohlc_datetime_col: Optional[str] = None
        self.ohlc_open_col: Optional[str] = None
        self.ohlc_high_col: Optional[str] = None
        self.ohlc_low_col: Optional[str] = None
        self.ohlc_close_col: Optional[str] = None
        self.ohlc_volume_col: Optional[str] = None

        # Instrument master table column mapping
        self.inst_table_name: Optional[str] = None
        self.inst_instrument_token_col: Optional[str] = None
        self.inst_exchange_col: Optional[str] = None
        self.inst_segment_col: Optional[str] = None
        self.inst_symbol_col: Optional[str] = None
        self.inst_expiry_col: Optional[str] = None
        self.inst_strike_col: Optional[str] = None
        self.inst_option_type_col: Optional[str] = None
        self.inst_lot_size_col: Optional[str] = None

    @property
    def is_db_configured(self) -> bool:
        return all([self.db_host, self.db_user, self.db_name])

    @property
    def is_ohlc_mapped(self) -> bool:
        return all([
            self.ohlc_table_name,
            self.ohlc_instrument_token_col,
            self.ohlc_datetime_col,
            self.ohlc_open_col,
            self.ohlc_high_col,
            self.ohlc_low_col,
            self.ohlc_close_col,
        ])

    @property
    def is_instrument_mapped(self) -> bool:
        return all([
            self.inst_table_name,
            self.inst_instrument_token_col,
            self.inst_symbol_col,
        ])

    @property
    def connection_string(self) -> str:
        return (
            f"postgresql://{self.db_user}:{self.db_password}"
            f"@{self.db_host}:{self.db_port}/{self.db_name}"
        )

    def set_db_connection(
        self,
        host: str,
        port: int,
        user: str,
        password: str,
        name: str,
    ) -> None:
        self.db_host = host
        self.db_port = port
        self.db_user = user
        self.db_password = password
        self.db_name = name

    def set_ohlc_mapping(
        self,
        table_name: str,
        instrument_token_col: str,
        datetime_col: str,
        open_col: str,
        high_col: str,
        low_col: str,
        close_col: str,
        volume_col: Optional[str] = None,
    ) -> None:
        self.ohlc_table_name = table_name
        self.ohlc_instrument_token_col = instrument_token_col
        self.ohlc_datetime_col = datetime_col
        self.ohlc_open_col = open_col
        self.ohlc_high_col = high_col
        self.ohlc_low_col = low_col
        self.ohlc_close_col = close_col
        self.ohlc_volume_col = volume_col

    def set_instrument_mapping(
        self,
        table_name: str,
        instrument_token_col: str,
        exchange_col: Optional[str] = None,
        segment_col: Optional[str] = None,
        symbol_col: Optional[str] = None,
        expiry_col: Optional[str] = None,
        strike_col: Optional[str] = None,
        option_type_col: Optional[str] = None,
        lot_size_col: Optional[str] = None,
    ) -> None:
        self.inst_table_name = table_name
        self.inst_instrument_token_col = instrument_token_col
        self.inst_exchange_col = exchange_col
        self.inst_segment_col = segment_col
        self.inst_symbol_col = symbol_col
        self.inst_expiry_col = expiry_col
        self.inst_strike_col = strike_col
        self.inst_option_type_col = option_type_col
        self.inst_lot_size_col = lot_size_col


def get_config() -> AppConfig:
    return AppConfig()
