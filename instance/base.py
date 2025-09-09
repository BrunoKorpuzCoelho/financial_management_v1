from datetime import datetime
from sqlalchemy import func, event
from pytz import timezone
from flask_login import UserMixin
from extensions import db  

class User(UserMixin, db.Model):
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(25), unique=True)
    password = db.Column(db.String(255))  
    name = db.Column(db.String(100))  
    type = db.Column(db.String(50))
    active = db.Column(db.Boolean, default=True)   
    is_locked = db.Column(db.Boolean, default=False)
    last_login = db.Column(db.DateTime)
    failed_login_attempts = db.Column(db.Integer)
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())  
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())

    def __init__(self, username, password, name, write_date, type, active=True):
        self.username = username
        self.password = password
        self.name = name
        self.write_date = write_date
        self.active = active
        self.type = type

class Expenses(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    gross_value = db.Column(db.Float, nullable=False)
    iva_rate = db.Column(db.Float, nullable=False)
    iva_value = db.Column(db.Float, nullable=False)
    net_value = db.Column(db.Float, nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('expenses', lazy=True))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref('expenses', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __init__(self, transaction_type, description, gross_value, iva_rate, iva_value, net_value, user_id, company_id):
        self.transaction_type = transaction_type
        self.description = description
        self.gross_value = gross_value
        self.iva_rate = iva_rate
        self.iva_value = iva_value
        self.net_value = net_value
        self.user_id = user_id
        self.company_id = company_id

class Employee(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False)
    is_active = db.Column(db.Boolean, default=True)
    position = db.Column(db.String(100), nullable=False)
    gross_salary = db.Column(db.Float, nullable=False)
    irs_rate = db.Column(db.Float, default=0) 
    social_security_rate = db.Column(db.Float, default=0)  
    employer_social_security_rate = db.Column(db.Float, default=0)  
    extra_payment = db.Column(db.Float, default=0)  
    extra_payment_description = db.Column(db.String(255)) 
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('employees', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __init__(self, name, gross_salary, position, company_id, 
                 social_security_rate=0, employer_social_security_rate=0,
                 irs_rate=0, extra_payment=0, extra_payment_description=None, is_active=True):
        self.name = name
        self.gross_salary = gross_salary
        self.position = position
        self.company_id = company_id
        self.social_security_rate = social_security_rate
        self.employer_social_security_rate = employer_social_security_rate
        self.irs_rate = irs_rate
        self.extra_payment = extra_payment
        self.extra_payment_description = extra_payment_description
        self.is_active = is_active

class MonthlySummary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    total_sales = db.Column(db.Float, default=0.0)
    total_sales_without_vat = db.Column(db.Float, default=0.0)
    total_vat = db.Column(db.Float, default=0.0)
    total_costs = db.Column(db.Float, default=0.0)
    total_costs_without_vat = db.Column(db.Float, default=0.0)
    profit = db.Column(db.Float, default=0.0)
    profit_without_vat = db.Column(db.Float, default=0.0)
    total_employee_salaries = db.Column(db.Float, default=0.0) 
    total_employee_insurance = db.Column(db.Float, default=0.0) 
    total_employer_social_security = db.Column(db.Float, default=0.0)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('monthly_summaries', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    __table_args__ = (
        db.UniqueConstraint('month', 'year', 'company_id', name='_month_year_company_uc'),
    )
    
    def __init__(self, month, year, company_id, total_sales=0.0, total_sales_without_vat=0.0, 
                 total_vat=0.0, total_costs=0.0, profit=0.0, profit_without_vat=0.0, total_costs_without_vat=0.0):
        self.month = month
        self.year = year
        self.company_id = company_id
        self.total_sales = total_sales
        self.total_sales_without_vat = total_sales_without_vat
        self.total_vat = total_vat
        self.total_costs = total_costs
        self.profit = profit
        self.profit_without_vat = profit_without_vat
        self.total_costs_without_vat = total_costs_without_vat

class Company(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(100), nullable=False, index=True)
    location = db.Column(db.String(255), nullable=False)
    relationship_type = db.Column(db.String(50), nullable=False)
    tax_id = db.Column(db.String(30))
    phone = db.Column(db.String(20))
    email = db.Column(db.String(100))
    contact_person = db.Column(db.String(100))
    notes = db.Column(db.Text)
    is_active = db.Column(db.Boolean, default=True)
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref('companies', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __init__(self, name, location, relationship_type, user_id, tax_id=None, phone=None, email=None, contact_person=None, notes=None, is_active=True):
        self.name = name
        self.location = location
        self.relationship_type = relationship_type
        self.user_id = user_id
        self.tax_id = tax_id
        self.phone = phone
        self.email = email
        self.contact_person = contact_person
        self.notes = notes
        self.is_active = is_active

class SimpleExpenses(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    transaction_type = db.Column(db.String(50), nullable=False)
    description = db.Column(db.String(255), nullable=False)
    gross_value = db.Column(db.Float, nullable=False)
    iva_rate = db.Column(db.Float, nullable=False)
    iva_value = db.Column(db.Float, nullable=False)
    net_value = db.Column(db.Float, nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('simple_expenses', lazy=True))
    user_id = db.Column(db.Integer, db.ForeignKey('user.id'), nullable=False)
    user = db.relationship('User', backref=db.backref('simple_expenses', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __init__(self, transaction_type, description, gross_value, iva_rate, iva_value, net_value, user_id, company_id):
        self.transaction_type = transaction_type
        self.description = description
        self.gross_value = gross_value
        self.iva_rate = iva_rate
        self.iva_value = iva_value
        self.net_value = net_value
        self.user_id = user_id
        self.company_id = company_id

class SimpleMonthlySummary(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    month = db.Column(db.Integer, nullable=False)
    year = db.Column(db.Integer, nullable=False)
    total_sales = db.Column(db.Float, default=0.0)
    total_sales_without_vat = db.Column(db.Float, default=0.0)
    total_vat = db.Column(db.Float, default=0.0)
    total_costs = db.Column(db.Float, default=0.0)
    profit = db.Column(db.Float, default=0.0)
    profit_without_vat = db.Column(db.Float, default=0.0)
    total_employee_salaries = db.Column(db.Float, default=0.0) 
    total_employee_insurance = db.Column(db.Float, default=0.0) 
    total_employer_social_security = db.Column(db.Float, default=0.0)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('simple_monthly_summaries', lazy=True))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    __table_args__ = (
        db.UniqueConstraint('month', 'year', 'company_id', name='_simple_month_year_company_uc'),
    )
    
    def __init__(self, month, year, company_id, total_sales=0.0, total_sales_without_vat=0.0, 
                 total_vat=0.0, total_costs=0.0, profit=0.0, profit_without_vat=0.0):
        self.month = month
        self.year = year
        self.company_id = company_id
        self.total_sales = total_sales
        self.total_sales_without_vat = total_sales_without_vat
        self.total_vat = total_vat
        self.total_costs = total_costs
        self.profit = profit
        self.profit_without_vat = profit_without_vat

class Settings(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    total_insurance_value = db.Column(db.Float, default=0.0, nullable=False)
    rent_value = db.Column(db.Float, default=0.0, nullable=False)
    employee_insurance_value = db.Column(db.Float, default=0.0, nullable=False)
    preferred_salary_expense_day = db.Column(db.Integer, default=1, nullable=False)
    other_expenses = db.Column(db.Float, default=0.0, nullable=False)
    company_id = db.Column(db.Integer, db.ForeignKey('company.id'), nullable=False)
    company = db.relationship('Company', backref=db.backref('settings', lazy=True, uselist=False))
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    __table_args__ = (
        db.UniqueConstraint('company_id', name='_company_settings_uc'),
    )
    
    def __init__(self, company_id, total_insurance_value=0.0, rent_value=0.0, 
                 employee_insurance_value=0.0, preferred_salary_expense_day=1, other_expenses=0.0):
        self.company_id = company_id
        self.total_insurance_value = total_insurance_value
        self.rent_value = rent_value
        self.employee_insurance_value = employee_insurance_value
        self.preferred_salary_expense_day = preferred_salary_expense_day
        self.other_expenses = other_expenses

class Info(db.Model):
    id = db.Column(db.Integer, primary_key=True)
    payment_vps_date = db.Column(db.Date, nullable=True)
    subscription_type_vps = db.Column(db.String(100), nullable=True)
    create_date = db.Column(db.DateTime, default=db.func.current_timestamp())
    write_date = db.Column(db.DateTime, default=db.func.current_timestamp(), onupdate=db.func.current_timestamp())
    
    def __init__(self, payment_vps_date=None, subscription_type_vps=None):
        self.payment_vps_date = payment_vps_date
        self.subscription_type_vps = subscription_type_vps