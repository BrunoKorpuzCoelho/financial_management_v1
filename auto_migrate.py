from flask_migrate import upgrade, migrate, init, stamp
import os

def run_auto_migration(app):
    with app.app_context():
        if not os.path.exists('migrations'):
            init()
            stamp()
        print("Generating and applying automatic migration...")
        migrate(message="auto migration")
        upgrade()
        print("Migration completed.")