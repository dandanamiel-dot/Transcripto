import logging

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

logger = logging.getLogger(__name__)

engine = create_async_engine(settings.database_url, echo=False)
async_session = async_sessionmaker(engine, class_=AsyncSession, expire_on_commit=False)


class Base(DeclarativeBase):
    pass


async def get_db():
    async with async_session() as session:
        yield session


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    # Add columns that create_all won't add to existing tables
    async with engine.begin() as conn:
        for col_ddl in (
            "ALTER TABLE projects ADD COLUMN speaker_names JSON",
            "ALTER TABLE projects ADD COLUMN progress_step VARCHAR(50)",
            "ALTER TABLE projects ADD COLUMN progress_current INTEGER",
        ):
            try:
                await conn.execute(text(col_ddl))
                logger.info(f"Migrated: {col_ddl}")
            except Exception:
                pass  # column already exists
