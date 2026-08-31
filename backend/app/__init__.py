from flask import Flask
from flask_cors import CORS

from .config import Config
from .models import db


def create_app() -> Flask:
    app = Flask(__name__)

    app.config.from_object(Config)

    db.init_app(app)

    CORS(
        app,
        origins=[app.config["FRONTEND_URL"]],
        supports_credentials=True,
    )

    from .routes import api

    app.register_blueprint(api)

    with app.app_context():
        db.create_all()

    return app