from datetime import datetime
from instance.base import User
from instance.base import db

def create_admin():
    cubix = User.query.filter_by(username="cubix").first()
    if not cubix:
        user = User(
            username="cubix",
            password="cubix1@",  
            name="Administrator",
            type="Admin",
            write_date=datetime.now()
        )
        user.is_locked = False
        user.failed_login_attempts = 0
        
        db.session.add(user)
        db.session.commit()

def create_basic_user():
    basic_user = User.query.filter_by(username="pedro").first()
    if not basic_user:
        user = User(
            username="pedro",
            password="pedro",  
            name="Basic User",
            type="User",
            write_date=datetime.now()
        )
        user.is_locked = False
        user.failed_login_attempts = 0
        
        db.session.add(user)
        db.session.commit()

def create_basic_user2():
    basic_user = User.query.filter_by(username="aksana").first()
    if not basic_user:
        user = User(
            username="aksana",
            password="aksana",  
            name="Basic User",
            type="User",
            write_date=datetime.now()
        )
        user.is_locked = False
        user.failed_login_attempts = 0
        
        db.session.add(user)
        db.session.commit()

def create_users():
    create_admin()
    create_basic_user()
    create_basic_user2()