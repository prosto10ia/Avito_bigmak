from flask import Flask, jsonify
from sqlalchemy import text

from . import db
from .config import Config
from .models import Base


def create_app(test_config: dict | None = None) -> Flask:
    app = Flask(__name__)
    app.config.from_object(Config)
    if test_config:
        app.config.update(test_config)
        if "DATABASE_URL" in test_config:
            from sqlalchemy import create_engine
            from sqlalchemy.orm import sessionmaker

            db.engine = create_engine(test_config["DATABASE_URL"], future=True)
            db.SessionLocal = sessionmaker(bind=db.engine, autoflush=False, expire_on_commit=False)
    Base.metadata.create_all(db.engine)
    from .api.auth import bp as auth_bp
    from .api.calendar import bp as calendar_bp
    from .api.chat import bp as chat_bp
    from .api.dashboard import bp as dashboard_bp
    from .api.mcp import bp as mcp_bp
    from .api.pulse import bp as pulse_bp
    from .api.roadmap import bp as roadmap_bp
    from .api.telemetry import bp as telemetry_bp

    app.register_blueprint(auth_bp, url_prefix="/api/v1")
    app.register_blueprint(dashboard_bp, url_prefix="/api/v1")
    app.register_blueprint(telemetry_bp, url_prefix="/api/v1")
    app.register_blueprint(roadmap_bp, url_prefix="/api/v1")
    app.register_blueprint(chat_bp, url_prefix="/api/v1")
    app.register_blueprint(mcp_bp, url_prefix="/api/v1")
    app.register_blueprint(calendar_bp, url_prefix="/api/v1")
    app.register_blueprint(pulse_bp, url_prefix="/api/v1")

    @app.get("/health")
    def health():
        try:
            with db.engine.connect() as connection:
                connection.execute(text("SELECT 1"))
            redis_status = "skipped"
            if not app.config.get("TESTING"):
                from redis import Redis

                Redis.from_url(
                    app.config["REDIS_URL"], socket_connect_timeout=1, socket_timeout=1
                ).ping()
                redis_status = "ok"
            return jsonify(
                {
                    "status": "ok",
                    "database": "ok",
                    "redis": redis_status,
                    "offline_llm": not bool(app.config.get("LLM_API_KEY")),
                }
            )
        except Exception:
            return jsonify({"status": "degraded", "database": "unavailable"}), 503

    return app
