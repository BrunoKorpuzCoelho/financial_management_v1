import sys
sys.dont_write_bytecode = True

from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, session
from flask_login import login_required, logout_user, current_user, login_user
from sqlalchemy import event
import calendar
import os
import base64
from extensions import db, login_manager
from instance.install_core import install_core
from datetime import datetime, timedelta
from instance.base import Expenses, Employee, Company, MonthlySummary, SimpleMonthlySummary, SimpleExpenses, Settings, Info
from day_checker import start_day_checker
from flask_migrate import Migrate
from auto_migrate import run_auto_migration


app = Flask(__name__)
migrate = Migrate(app, db)

basedir = os.path.abspath(os.path.dirname(__file__))

app.config["SQLALCHEMY_DATABASE_URI"] = f"sqlite:///{os.path.join(basedir, 'instance', 'test.db')}"
app.config["SECRET_KEY"] = os.urandom(24)

db.init_app(app)
login_manager.init_app(app)
login_manager.login_view = "login"  

@login_manager.user_loader
def load_user(user_id):
    from instance.base import User
    return User.query.get(int(user_id))

@app.route('/main-menu/<company_id>')
@login_required
def index(company_id):
    if company_id:
        return render_template('dashboard.html', company_id=company_id)
    else:
        return redirect(url_for('company'))
    
@app.route('/')
@login_required
def main():
    return render_template("login.html")

@app.route('/login', methods=["GET", "POST"])
def login():
    if request.method == "POST":
        username = request.form.get("username")
        password = request.form.get("password")
        
        from instance.base import User
        user = User.query.filter_by(username=username).first()

        if not user:
            flash("❌ Usuário não encontrado!", "error")
            return render_template("login.html")
        
        elif user.is_locked:
            flash("🚫 Usuário bloqueado! Entre em contato com o suporte.", "error")
            return render_template("login.html")
        
        elif user.password != password:
            if user.failed_login_attempts is None:
                user.failed_login_attempts = 0
            
            user.failed_login_attempts += 1

            if user.failed_login_attempts >= 3:
                user.is_locked = True
                flash(f"❌ Muitas tentativas falhas! Usuário bloqueado.", "error")
            else:
                flash(f"❌ Senha incorreta! Tentativa {user.failed_login_attempts}/3", "error")
            
            db.session.commit()
            return render_template("login.html")
        
        else:
            user.failed_login_attempts = 0
            user.last_login = datetime.utcnow()
            db.session.commit()
            
            login_user(user)
            return redirect(url_for("company"))
    
    return render_template("login.html")

@app.route('/logout')
@login_required
def logout():
    if 'expiration_warning_shown' in session:
        session.pop('expiration_warning_shown')
    
    logout_user()
    return redirect(url_for('login'))

@app.route('/expenses/<int:company_id>')
@login_required
def expenses(company_id):
    page = request.args.get('page', 1, type=int)  
    per_page = 100  
    user_type = current_user.type
    
    pagination = Expenses.query.filter_by(company_id=company_id).order_by(Expenses.create_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
    
    all_expenses = pagination.items

    return render_template('expenses.html', user_type=user_type, expenses=all_expenses, pagination=pagination, company_id=company_id)

@app.route('/add-expenses', methods=['POST'])
@login_required
def add_expense():
    try:
        company_id = request.form.get('company_id')
        
        if not company_id:
            flash('❌ ID da empresa não fornecido.', 'error')
            return redirect(url_for('company'))
            
        transaction_type = request.form.get('transaction_type')
        description = request.form.get('description')
        gross_value = float(request.form.get('gross_value'))
        iva_rate = float(request.form.get('iva_rate'))
        iva_value = float(request.form.get('iva_value'))
        net_value = float(request.form.get('net_value'))
        
        if not all([transaction_type, description, gross_value >= 0, iva_rate >= 0]):
            flash('❌ Por favor, preencha todos os campos corretamente.', 'error')
            return redirect(url_for('expenses', company_id=company_id))
        
        # Adicionar nova transação à tabela Expenses
        new_expense = Expenses(
            transaction_type=transaction_type,
            description=description,
            gross_value=gross_value,
            iva_rate=iva_rate,
            iva_value=iva_value,
            net_value=net_value,
            user_id=current_user.id,
            company_id=int(company_id) 
        )
        
        db.session.add(new_expense)
        db.session.commit()
        
        update_monthly_summary(new_expense)
        
        flash('✅ Transação adicionada com sucesso!', 'success')
        return redirect(url_for('expenses', company_id=company_id))
        
    except Exception as e:
        db.session.rollback()
        company_id = request.form.get('company_id')
        if company_id:
            flash(f'❌ Erro ao adicionar transação: {str(e)}', 'error')
            return redirect(url_for('expenses', company_id=company_id))
        else:
            flash(f'❌ Erro ao adicionar transação: {str(e)}', 'error')
            return redirect(url_for('company'))
        
def update_monthly_summary(expense):
    try:
        transaction_date = expense.create_date
        month = transaction_date.month
        year = transaction_date.year
        
        print(f"Updating monthly summary for: Month {month}, Year {year}, Company {expense.company_id}")
        
        summary = MonthlySummary.query.filter_by(
            month=month, 
            year=year,
            company_id=expense.company_id
        ).first()
        
        if not summary:
            print(f"Creating new monthly summary")
            summary = MonthlySummary(
                month=month,
                year=year,
                company_id=expense.company_id,
                total_sales=0.0,
                total_sales_without_vat=0.0,
                total_vat=0.0,
                total_costs=0.0,
                total_costs_without_vat=0.0,  # Inicializa explicitamente como 0.0
                profit=0.0,
                profit_without_vat=0.0
            )
            db.session.add(summary)
        
        # Garantir que todos os campos numéricos são inicializados
        if summary.total_costs_without_vat is None:
            summary.total_costs_without_vat = 0.0
        if summary.total_sales_without_vat is None:
            summary.total_sales_without_vat = 0.0
        
        if expense.transaction_type.lower() == 'ganho':
            print(f"Processing gain: {expense.gross_value}")
            summary.total_sales += expense.gross_value
            summary.total_sales_without_vat += expense.net_value
            summary.total_vat += expense.iva_value
        elif expense.transaction_type.lower() == 'despesa':
            print(f"Processing expense: {expense.gross_value}")
            summary.total_costs += expense.gross_value
            summary.total_costs_without_vat += expense.net_value
            summary.total_vat -= expense.iva_value
        
        # Atualizar cálculos de lucro
        summary.profit = summary.total_sales - summary.total_costs
        summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs_without_vat
        
        print(f"Committing changes: profit={summary.profit}, profit_without_vat={summary.profit_without_vat}")
        db.session.commit()
        print("Monthly summary updated successfully")
    except Exception as e:
        db.session.rollback()
        print(f"Error updating monthly summary: {str(e)}")
        raise
    
@app.route('/delete-expense/<int:expense_id>', methods=['POST'])
@login_required
def delete_expense(expense_id):
    try:
        expense = Expenses.query.get_or_404(expense_id)
        
        if expense.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'Acesso negado'}), 403
        
        company = Company.query.get(expense.company_id)
        if company and company.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'Acesso negado à empresa'}, 403)
        
        transaction_type = expense.transaction_type
        gross_value = expense.gross_value
        net_value = expense.net_value
        iva_value = expense.iva_value
        company_id = expense.company_id
        transaction_date = expense.create_date
        
        db.session.delete(expense)
        db.session.commit()
        
        remove_from_monthly_summary(
            transaction_date,
            company_id,
            transaction_type,
            gross_value,
            net_value,
            iva_value
        )
        
        return jsonify({'success': True, 'company_id': company_id}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500
    
def remove_from_monthly_summary(date, company_id, transaction_type, gross_value, net_value, iva_value):
    try:
        month = date.month
        year = date.year
        
        print(f"Removing from monthly summary: Month {month}, Year {year}, Company {company_id}")
        
        summary = MonthlySummary.query.filter_by(
            month=month, 
            year=year,
            company_id=company_id
        ).first()
        
        if summary:
            # Garantir que todos os campos numéricos são inicializados
            if summary.total_costs_without_vat is None:
                summary.total_costs_without_vat = 0.0
            if summary.total_sales_without_vat is None:
                summary.total_sales_without_vat = 0.0
                
            if transaction_type.lower() == 'ganho':
                summary.total_sales -= gross_value
                summary.total_sales_without_vat -= net_value
                summary.total_vat -= iva_value
            elif transaction_type.lower() == 'despesa':
                summary.total_costs -= gross_value
                summary.total_costs_without_vat -= net_value
                summary.total_vat += iva_value
            
            summary.profit = summary.total_sales - summary.total_costs
            summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs_without_vat
            
            print(f"Committing changes: profit={summary.profit}, profit_without_vat={summary.profit_without_vat}")
            db.session.commit()
            print("Monthly summary updated successfully after removal")
    except Exception as e:
        db.session.rollback()
        print(f"Error removing from monthly summary: {str(e)}")
        raise
    
@app.route('/get-expense/<int:expense_id>')
@login_required
def get_expense(expense_id):
    try:
        expense = Expenses.query.get_or_404(expense_id)
        
        
        expense_dict = {
            'id': expense.id,
            'transaction_type': expense.transaction_type,
            'description': expense.description,
            'gross_value': expense.gross_value,
            'iva_rate': expense.iva_rate,
            'iva_value': expense.iva_value,
            'net_value': expense.net_value,
            'company_id': expense.company_id 
        }
        
        return jsonify({'success': True, 'expense': expense_dict})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/update-expense/<int:expense_id>', methods=['POST'])
@login_required
def update_expense(expense_id):
    try:
        expense = Expenses.query.get_or_404(expense_id)
        
        company_id = request.form.get('company_id')
        if not company_id:
            company_id = expense.company_id
        
        if expense.user_id != current_user.id and current_user.type != 'Admin':
            flash('❌ Você não tem permissão para editar esta transação.', 'error')
            return redirect(url_for('expenses', company_id=company_id))
        
        old_transaction_type = expense.transaction_type
        old_gross_value = expense.gross_value
        old_net_value = expense.net_value
        old_iva_value = expense.iva_value
        
        expense.transaction_type = request.form.get('transaction_type')
        expense.description = request.form.get('description')
        expense.gross_value = float(request.form.get('gross_value'))
        expense.iva_rate = float(request.form.get('iva_rate'))
        expense.iva_value = float(request.form.get('iva_value'))
        expense.net_value = float(request.form.get('net_value'))
        
        db.session.commit()
        
        adjust_monthly_summary(
            expense,
            old_transaction_type,
            old_gross_value,
            old_net_value,
            old_iva_value
        )
        
        flash('✅ Transação atualizada com sucesso!', 'success')
        return redirect(url_for('expenses', company_id=company_id))
        
    except Exception as e:
        db.session.rollback()
        
        company_id = request.form.get('company_id')
        if not company_id and expense:
            company_id = expense.company_id
            
        flash(f'❌ Erro ao atualizar transação: {str(e)}', 'error')
        
        if company_id:
            return redirect(url_for('expenses', company_id=company_id))
        else:
            return redirect(url_for('company'))
        
def adjust_monthly_summary(expense, old_type, old_gross, old_net, old_iva):
    try:
        transaction_date = expense.create_date
        month = transaction_date.month
        year = transaction_date.year
        
        print(f"Adjusting monthly summary for: Month {month}, Year {year}, Company {expense.company_id}")
        
        summary = MonthlySummary.query.filter_by(
            month=month, 
            year=year,
            company_id=expense.company_id
        ).first()
        
        if not summary:
            print(f"Creating new monthly summary during adjustment")
            summary = MonthlySummary(
                month=month,
                year=year,
                company_id=expense.company_id,
                total_sales=0.0,
                total_sales_without_vat=0.0,
                total_vat=0.0,
                total_costs=0.0,
                total_costs_without_vat=0.0,  # Inicializa explicitamente como 0.0
                profit=0.0,
                profit_without_vat=0.0
            )
            db.session.add(summary)
            
            if expense.transaction_type.lower() == 'ganho':
                summary.total_sales += expense.gross_value
                summary.total_sales_without_vat += expense.net_value
                summary.total_vat += expense.iva_value
            elif expense.transaction_type.lower() == 'despesa':
                summary.total_costs += expense.gross_value
                summary.total_costs_without_vat += expense.net_value
                summary.total_vat -= expense.iva_value  
        else:
            # Garantir que todos os campos numéricos são inicializados
            if summary.total_costs_without_vat is None:
                summary.total_costs_without_vat = 0.0
            if summary.total_sales_without_vat is None:
                summary.total_sales_without_vat = 0.0
                
            # Remover os valores antigos
            if old_type.lower() == 'ganho':
                summary.total_sales -= old_gross
                summary.total_sales_without_vat -= old_net
                summary.total_vat -= old_iva
            elif old_type.lower() == 'despesa':
                summary.total_costs -= old_gross
                summary.total_costs_without_vat -= old_net
                summary.total_vat += old_iva  
            
            # Adicionar os novos valores
            if expense.transaction_type.lower() == 'ganho':
                summary.total_sales += expense.gross_value
                summary.total_sales_without_vat += expense.net_value
                summary.total_vat += expense.iva_value
            elif expense.transaction_type.lower() == 'despesa':
                summary.total_costs += expense.gross_value
                summary.total_costs_without_vat += expense.net_value
                summary.total_vat -= expense.iva_value 
        
        summary.profit = summary.total_sales - summary.total_costs
        summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs_without_vat
        
        print(f"Committing changes: profit={summary.profit}, profit_without_vat={summary.profit_without_vat}")
        db.session.commit()
        print("Monthly summary adjusted successfully")
    except Exception as e:
        db.session.rollback()
        print(f"Error adjusting monthly summary: {str(e)}")
        raise
    
@app.route('/employee/<int:company_id>')
@login_required
def employee(company_id):
    company = Company.query.get_or_404(company_id)
    return render_template('employee.html', company_id=company_id, company=company)

@app.route('/add-employee', methods=['POST'])
@login_required
def add_employee():
    try:
        name = request.form.get('employeeName')
        position = request.form.get('employeePosition')
        gross_salary = float(request.form.get('employeeSalary', 0))
        social_security_rate = float(request.form.get('employeeSocialSecurity', 11.0))
        employer_social_security_rate = float(request.form.get('employerSocialSecurity', 23.75))
        irs_rate = float(request.form.get('employeeIRS', 0))
        extra_payment = float(request.form.get('extraPayment', 0))
        extra_payment_description = request.form.get('extraPaymentDescription', '')
        company_id = request.form.get('company_id')
        
        if not all([name, position, gross_salary > 0, company_id]):
            return jsonify({
                'success': False, 
                'message': 'Por favor, preencha todos os campos obrigatórios corretamente.'
            }), 400
        
        company = Company.query.get(company_id)
        if not company or company.user_id != current_user.id:
            return jsonify({
                'success': False,
                'message': 'Empresa inválida ou sem permissão de acesso.'
            }), 403
        
        new_employee = Employee(
            name=name,
            position=position,
            gross_salary=gross_salary,
            social_security_rate=social_security_rate,
            employer_social_security_rate=employer_social_security_rate,
            irs_rate=irs_rate,
            extra_payment=extra_payment,
            extra_payment_description=extra_payment_description,
            company_id=int(company_id)
        )
        
        db.session.add(new_employee)
        db.session.commit()
        
        employee_data = {
            'id': new_employee.id,
            'name': new_employee.name,
            'position': new_employee.position,
            'gross_salary': new_employee.gross_salary,
            'social_security_rate': new_employee.social_security_rate,
            'employer_social_security_rate': new_employee.employer_social_security_rate,
            'irs_rate': new_employee.irs_rate,
            'extra_payment': new_employee.extra_payment,
            'extra_payment_description': new_employee.extra_payment_description,
            'is_active': new_employee.is_active,
            'company_id': new_employee.company_id
        }
        
        return jsonify({
            'success': True, 
            'message': 'Empregado adicionado com sucesso!',
            'employee': employee_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False, 
            'message': f'Erro ao adicionar empregado: {str(e)}'
        }), 500

@app.route('/get-employees/<int:company_id>')
@login_required
def get_employees(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        
        employees = Employee.query.filter_by(company_id=company_id).all()
        employees_list = []
        
        for emp in employees:
            employees_list.append({
                'id': emp.id,
                'name': emp.name,
                'position': emp.position,
                'gross_salary': emp.gross_salary,
                'social_security_rate': emp.social_security_rate,
                'employer_social_security_rate': emp.employer_social_security_rate,
                'irs_rate': emp.irs_rate,
                'extra_payment': emp.extra_payment,
                'extra_payment_description': emp.extra_payment_description,
                'is_active': emp.is_active,
                'company_id': emp.company_id
            })
        
        return jsonify({
            'success': True,
            'employees': employees_list
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar empregados: {str(e)}'
        }), 500
    
@app.route('/update-employee/<int:employee_id>', methods=['POST'])
@login_required
def update_employee(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        
        company = Company.query.get(employee.company_id)
        if not company or company.user_id != current_user.id:
            return jsonify({
                'success': False,
                'message': 'Acesso negado a este empregado.'
            }), 403
        
        company_id = request.form.get('company_id', employee.company_id)
        
        if int(company_id) != employee.company_id:
            new_company = Company.query.get(company_id)
            if not new_company or new_company.user_id != current_user.id:
                return jsonify({
                    'success': False,
                    'message': 'Acesso negado à empresa de destino.'
                }), 403
        
        employee.name = request.form.get('employeeName')
        employee.position = request.form.get('employeePosition')
        employee.gross_salary = float(request.form.get('employeeSalary', 0))
        employee.social_security_rate = float(request.form.get('employeeSocialSecurity', 11.0))
        employee.employer_social_security_rate = float(request.form.get('employerSocialSecurity', 23.75))
        employee.irs_rate = float(request.form.get('employeeIRS', 0))
        employee.extra_payment = float(request.form.get('extraPayment', 0))
        employee.extra_payment_description = request.form.get('extraPaymentDescription', '')
        employee.company_id = int(company_id)
        
        db.session.commit()
        
        employee_data = {
            'id': employee.id,
            'name': employee.name,
            'position': employee.position,
            'gross_salary': employee.gross_salary,
            'social_security_rate': employee.social_security_rate,
            'employer_social_security_rate': employee.employer_social_security_rate,
            'irs_rate': employee.irs_rate,
            'extra_payment': employee.extra_payment,
            'extra_payment_description': employee.extra_payment_description,
            'is_active': employee.is_active,
            'company_id': employee.company_id
        }
        
        return jsonify({
            'success': True,
            'message': 'Empregado atualizado com sucesso!',
            'employee': employee_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao atualizar empregado: {str(e)}'
        }), 500
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao atualizar empregado: {str(e)}'
        }), 500
    
@app.route('/delete-employee/<int:employee_id>', methods=['POST'])
@login_required
def delete_employee(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        
        company = Company.query.get(employee.company_id)
        if not company or company.user_id != current_user.id:
            return jsonify({
                'success': False,
                'message': 'Acesso negado a este empregado.'
            }), 403
        
        company_id = employee.company_id
        
        db.session.delete(employee)
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Empregado removido com sucesso!',
            'company_id': company_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao remover empregado: {str(e)}'
        }), 500
    
@app.route('/get-employee/<int:employee_id>')
@login_required
def get_employee(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        
        company = Company.query.get(employee.company_id)
        if not company or company.user_id != current_user.id:
            return jsonify({
                'success': False,
                'message': 'Acesso negado a este empregado.'
            }), 403
        
        employee_data = {
            'id': employee.id,
            'name': employee.name,
            'position': employee.position,
            'gross_salary': employee.gross_salary,
            'social_security_rate': employee.social_security_rate,
            'employer_social_security_rate': employee.employer_social_security_rate,
            'irs_rate': employee.irs_rate,
            'extra_payment': employee.extra_payment,
            'extra_payment_description': employee.extra_payment_description,
            'is_active': employee.is_active,
            'company_id': employee.company_id
        }
        
        return jsonify({
            'success': True,
            'employee': employee_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar empregado: {str(e)}'
        }), 500
    
@app.route('/toggle-employee-status/<int:employee_id>', methods=['POST'])
@login_required
def toggle_employee_status(employee_id):
    try:
        employee = Employee.query.get_or_404(employee_id)
        
        company = Company.query.get(employee.company_id)
        if not company or company.user_id != current_user.id:
            return jsonify({
                'success': False,
                'message': 'Acesso negado a este empregado.'
            }), 403
        
        new_status = request.form.get('is_active', '')
        
        if new_status.lower() == 'true':
            employee.is_active = True
        else:
            employee.is_active = False
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Status do empregado atualizado com sucesso!',
            'is_active': employee.is_active,
            'company_id': employee.company_id
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao atualizar status do empregado: {str(e)}'
        }), 500
    
@app.route('/company')
@login_required
def company():
    companies = Company.query.all()
    return render_template('company.html', companies=companies)

@app.route('/add-company', methods=['POST'])
@login_required
def add_company():
    try:
        name = request.form.get('name')
        location = request.form.get('location', '')
        relationship_type = request.form.get('relationship_type', '')
        tax_id = request.form.get('tax_id')
        phone = request.form.get('phone')
        email = request.form.get('email')
        contact_person = request.form.get('contact_person')
        notes = request.form.get('notes')
        
        if not name:
            return jsonify({
                'success': False,
                'message': 'O nome da empresa é obrigatório.'
            }), 400
            
        new_company = Company(
            name=name,
            location=location,
            relationship_type=relationship_type,
            user_id=current_user.id,
            tax_id=tax_id,
            phone=phone,
            email=email,
            contact_person=contact_person,
            notes=notes,
            is_active=True
        )
        
        db.session.add(new_company)
        db.session.commit()
        
        company_data = {
            'id': new_company.id,
            'name': new_company.name,
            'location': new_company.location,
            'relationship_type': new_company.relationship_type,
            'tax_id': new_company.tax_id
        }
        
        return jsonify({
            'success': True,
            'message': 'Empresa criada com sucesso!',
            'company': company_data
        }), 201
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao criar empresa: {str(e)}'
        }), 500

@app.route('/get-companies')
@login_required
def get_companies():
    try:
        companies = Company.query.all()
        companies_list = []
        
        for company in companies:
            companies_list.append({
                'id': company.id,
                'name': company.name,
                'location': company.location,
                'relationship_type': company.relationship_type,
                'tax_id': company.tax_id,
                'is_active': company.is_active
            })
        
        return jsonify({
            'success': True,
            'companies': companies_list
        })
    
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar empresas: {str(e)}'
        }), 500
    
@app.route('/get-company/<int:company_id>')
@login_required
def get_company(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        
        company_data = {
            'id': company.id,
            'name': company.name,
            'location': company.location,
            'relationship_type': company.relationship_type,
            'tax_id': company.tax_id,
            'phone': company.phone,
            'email': company.email,
            'contact_person': company.contact_person,
            'notes': company.notes,
            'is_active': company.is_active
        }
        
        return jsonify({
            'success': True,
            'company': company_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar empresa: {str(e)}'
        }), 500

@app.route('/update-company/<int:company_id>', methods=['POST'])
@login_required
def update_company(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        
        company.name = request.form.get('name')
        company.location = request.form.get('location', '')
        company.relationship_type = request.form.get('relationship_type', '')
        company.tax_id = request.form.get('tax_id')
        company.phone = request.form.get('phone')
        company.email = request.form.get('email')
        company.contact_person = request.form.get('contact_person')
        company.notes = request.form.get('notes')
        
        db.session.commit()
        
        company_data = {
            'id': company.id,
            'name': company.name,
            'location': company.location,
            'relationship_type': company.relationship_type,
            'tax_id': company.tax_id
        }
        
        return jsonify({
            'success': True,
            'message': 'Empresa atualizada com sucesso!',
            'company': company_data
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao atualizar empresa: {str(e)}'
        }), 500
    
@app.route('/dashboard/<int:company_id>')
@login_required
def dashboard(company_id):
    company = Company.query.get_or_404(company_id)
    return render_template('dashboard_viewer.html', company_id=company_id, company=company)

@app.route('/api/financial-summary')
@login_required
def api_financial_summary():
    try:
        company_id = request.args.get('company_id', type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if not all([company_id, month, year]):
            return jsonify({
                'success': False,
                'message': 'Parâmetros inválidos'
            }), 400
            
        summary = MonthlySummary.query.filter_by(
            company_id=company_id,
            month=month,
            year=year
        ).first()
        
        data = {}
        
        if summary:
            data = {
                'total_sales': summary.total_sales,
                'total_sales_without_vat': summary.total_sales_without_vat,
                'total_vat': summary.total_vat,
                'total_costs': summary.total_costs,
                'total_costs_without_vat': summary.total_costs_without_vat, 
                'profit': summary.profit,
                'profit_without_vat': summary.profit_without_vat,
                'total_employee_salaries': summary.total_employee_salaries,
                'total_employee_insurance': summary.total_employee_insurance,
                'total_employer_social_security': summary.total_employer_social_security
            }
            
            prev_month = month - 1
            prev_year = year
            
            if prev_month == 0:
                prev_month = 12
                prev_year -= 1
                
            prev_summary = MonthlySummary.query.filter_by(
                company_id=company_id,
                month=prev_month,
                year=prev_year
            ).first()
            
            if prev_summary:
                if prev_summary.total_sales > 0:
                    data['sales_change'] = ((summary.total_sales - prev_summary.total_sales) / prev_summary.total_sales) * 100
                
                if prev_summary.total_costs > 0:
                    data['costs_change'] = ((summary.total_costs - prev_summary.total_costs) / prev_summary.total_costs) * 100
                
                if prev_summary.profit > 0:
                    data['profit_change'] = ((summary.profit - prev_summary.profit) / prev_summary.profit) * 100
                
                if prev_summary.total_vat > 0:
                    data['vat_change'] = ((summary.total_vat - prev_summary.total_vat) / prev_summary.total_vat) * 100
                
                if prev_summary.total_employee_salaries > 0:
                    data['employee_costs_change'] = ((summary.total_employee_salaries - prev_summary.total_employee_salaries) / prev_summary.total_employee_salaries) * 100
        
        return jsonify({
            'success': True,
            'summary': data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar dados financeiros: {str(e)}'
        }), 500
    
@app.route('/api/chart-data')
@login_required
def api_chart_data():
    try:
        company_id = request.args.get('company_id', type=int)
        chart_type = request.args.get('type', 'bar')
        current_month = request.args.get('month', type=int)
        current_year = request.args.get('year', type=int)
        
        if not company_id:
            return jsonify({
                'success': False,
                'message': 'ID da empresa não fornecido'
            }), 400
            
        
        
        chart_data = {}
        
        if chart_type in ['bar', 'line']:
            labels = []
            sales_data = []
            expenses_data = []
            employee_costs_data = []
            profit_data = []
            
            for i in range(5, -1, -1):
                month = current_month - i
                year = current_year
                
                while month <= 0:
                    month += 12
                    year -= 1
                
                monthly_data = MonthlySummary.query.filter_by(
                    company_id=company_id,
                    month=month,
                    year=year
                ).first()
                
                month_name = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 
                              'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'][month-1]
                labels.append(f"{month_name}")
                
                if monthly_data:
                    sales_data.append(round(monthly_data.total_sales))
                    expenses_data.append(round(monthly_data.total_costs - (monthly_data.total_employee_salaries or 0)))
                    employee_costs_data.append(round(monthly_data.total_employee_salaries or 0))
                    profit_data.append(round(monthly_data.profit))
                else:
                    sales_data.append(0)
                    expenses_data.append(0)
                    employee_costs_data.append(0)
                    profit_data.append(0)
            
            chart_data = {
                'labels': labels,
                'datasets': [
                    {
                        'label': 'Receitas',
                        'data': sales_data,
                        'backgroundColor': '#22c55e',
                        'borderRadius': 4
                    },
                    {
                        'label': 'Despesas',
                        'data': expenses_data,
                        'backgroundColor': '#f59e0b',
                        'borderRadius': 4
                    },
                    {
                        'label': 'Custos Colaboradores',
                        'data': employee_costs_data,
                        'backgroundColor': '#8b5cf6',
                        'borderRadius': 4
                    }
                ]
            }
            
            if chart_type == 'line':
                chart_data = {
                    'labels': labels,
                    'datasets': [{
                        'label': 'Performance Financeira',
                        'data': profit_data,
                        'borderColor': '#3b82f6',
                        'backgroundColor': 'rgba(59, 130, 246, 0.1)',
                        'fill': True,
                        'tension': 0.4,
                        'pointBackgroundColor': '#3b82f6',
                        'pointBorderColor': '#ffffff',
                        'pointBorderWidth': 2,
                        'pointRadius': 6
                    }]
                }
        
        elif chart_type == 'pie':
            expenses = Expenses.query.filter(
                Expenses.company_id == company_id,
                Expenses.transaction_type == 'despesa',
                db.extract('month', Expenses.create_date) == current_month,
                db.extract('year', Expenses.create_date) == current_year
            ).all()
            
            expense_categories = {}
            for expense in expenses:
                category = expense.description.split(' ')[0] 
                if category in expense_categories:
                    expense_categories[category] += expense.gross_value
                else:
                    expense_categories[category] = expense.gross_value
            
            if len(expense_categories) < 3:
                expense_categories = {
                    'Materiais': 35,
                    'Serviços': 25,
                    'Equipamentos': 20,
                    'Marketing': 15,
                    'Outros': 5
                }
            
            labels = list(expense_categories.keys())
            data = list(expense_categories.values())
            
            colors = [
                '#22c55e', '#3b82f6', '#f59e0b', 
                '#ef4444', '#8b5cf6', '#06b6d4',
                '#ec4899', '#14b8a6', '#f97316'
            ]
            
            chart_data = {
                'labels': labels,
                'datasets': [{
                    'data': data,
                    'backgroundColor': colors[:len(data)],
                    'borderWidth': 0
                }]
            }
        
        return jsonify({
            'success': True,
            'chartData': chart_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar dados para o gráfico: {str(e)}'
        }), 500
    
@app.route('/api/transactions')
@login_required
def get_transactions():
    try:
        company_id = request.args.get('company_id', type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        transaction_type = request.args.get('type')
        
        if not all([company_id, month, year]):
            return jsonify({
                'success': False,
                'message': 'Parâmetros inválidos'
            }), 400
        
        query = Expenses.query.filter(
            Expenses.company_id == company_id,
            db.extract('month', Expenses.create_date) == month,
            db.extract('year', Expenses.create_date) == year
        )
        
        if transaction_type:
            query = query.filter(Expenses.transaction_type.ilike(f'%{transaction_type}%'))
            
        transactions = query.order_by(Expenses.create_date.desc()).all()
        
        transaction_list = []
        for transaction in transactions:
            transaction_list.append({
                'id': transaction.id,
                'transaction_type': transaction.transaction_type,
                'description': transaction.description,
                'gross_value': transaction.gross_value,
                'iva_rate': transaction.iva_rate,
                'iva_value': transaction.iva_value,
                'net_value': transaction.net_value,
                'create_date': transaction.create_date.strftime("%Y-%m-%d %H:%M:%S")
            })
        
        return jsonify({
            'success': True,
            'transactions': transaction_list
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar transações: {str(e)}'
        }), 500
    
@app.route('/simple-sales/<int:company_id>')
@login_required
def simple_sales(company_id):
    company = Company.query.get_or_404(company_id)
    page = request.args.get('page', 1, type=int)  
    per_page = 100
    user_type = current_user.type
    
    current_month = datetime.now().month
    current_year = datetime.now().year
    
    month = request.args.get('month', current_month, type=int)
    year = request.args.get('year', current_year, type=int)
    
    query = SimpleExpenses.query.filter_by(company_id=company_id)
    
    if month and year:
        query = query.filter(
            db.extract('month', SimpleExpenses.create_date) == month,
            db.extract('year', SimpleExpenses.create_date) == year
        )
    
    pagination = query.order_by(SimpleExpenses.create_date.desc()).paginate(page=page, per_page=per_page, error_out=False)
    all_expenses = pagination.items
    
    return render_template('simple_sales.html', 
                          company_id=company_id, 
                          company=company, 
                          user_type=user_type, 
                          pagination=pagination, 
                          expenses=all_expenses,
                          current_month=month,
                          current_year=year)

@app.route('/add-simple-expenses', methods=['POST'])
@login_required
def add_simple_expense():
    try:
        company_id = request.form.get('company_id')
        
        if not company_id:
            flash('❌ ID da empresa não fornecido.', 'error')
            return redirect(url_for('company'))
            
        transaction_type = request.form.get('transaction_type')
        description = request.form.get('description')
        gross_value = float(request.form.get('gross_value'))
        iva_rate = float(request.form.get('iva_rate'))
        iva_value = float(request.form.get('iva_value'))
        net_value = float(request.form.get('net_value'))
        
        if not all([transaction_type, description, gross_value >= 0, iva_rate >= 0]):
            flash('❌ Por favor, preencha todos os campos corretamente.', 'error')
            return redirect(url_for('simple_sales', company_id=company_id))
        
        new_expense = SimpleExpenses(
            transaction_type=transaction_type,
            description=description,
            gross_value=gross_value,
            iva_rate=iva_rate,
            iva_value=iva_value,
            net_value=net_value,
            user_id=current_user.id,
            company_id=int(company_id) 
        )
        
        db.session.add(new_expense)
        db.session.commit()
        
        update_simple_monthly_summary(new_expense)
        
        flash('✅ Transação adicionada com sucesso!', 'success')
        return redirect(url_for('simple_sales', company_id=company_id))
        
    except Exception as e:
        db.session.rollback()
        company_id = request.form.get('company_id')
        if company_id:
            flash(f'❌ Erro ao adicionar transação: {str(e)}', 'error')
            return redirect(url_for('simple_sales', company_id=company_id))
        else:
            flash(f'❌ Erro ao adicionar transação: {str(e)}', 'error')
            return redirect(url_for('company'))
        
def update_simple_monthly_summary(expense):
    transaction_date = expense.create_date
    month = transaction_date.month
    year = transaction_date.year
    
    summary = SimpleMonthlySummary.query.filter_by(
        month=month, 
        year=year,
        company_id=expense.company_id
    ).first()
    
    if not summary:
        summary = SimpleMonthlySummary(
            month=month,
            year=year,
            company_id=expense.company_id
        )
        db.session.add(summary)
    
    if expense.transaction_type.lower() == 'ganho':
        summary.total_sales += expense.gross_value
        summary.total_sales_without_vat += expense.net_value
        summary.total_vat += expense.iva_value
    elif expense.transaction_type.lower() == 'despesa':
        summary.total_costs += expense.gross_value
    
    summary.profit = summary.total_sales - summary.total_costs
    summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs
    
    db.session.commit()

@app.route('/delete-simple-expense/<int:expense_id>', methods=['POST'])
@login_required
def delete_simple_expense(expense_id):
    try:
        expense = SimpleExpenses.query.get_or_404(expense_id)
        
        if expense.user_id != current_user.id:
            return jsonify({'success': False, 'message': 'Acesso negado'}), 403
        
        transaction_type = expense.transaction_type
        gross_value = expense.gross_value
        net_value = expense.net_value
        iva_value = expense.iva_value
        company_id = expense.company_id
        transaction_date = expense.create_date
        
        db.session.delete(expense)
        db.session.commit()
        
        remove_from_simple_monthly_summary(
            transaction_date,
            company_id,
            transaction_type,
            gross_value,
            net_value,
            iva_value
        )
        
        return jsonify({'success': True, 'company_id': company_id}), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({'success': False, 'message': str(e)}), 500

def remove_from_simple_monthly_summary(date, company_id, transaction_type, gross_value, net_value, iva_value):
    month = date.month
    year = date.year
    
    summary = SimpleMonthlySummary.query.filter_by(
        month=month, 
        year=year,
        company_id=company_id
    ).first()
    
    if summary:
        if transaction_type.lower() == 'ganho':
            summary.total_sales -= gross_value
            summary.total_sales_without_vat -= net_value
            summary.total_vat -= iva_value
        elif transaction_type.lower() == 'despesa':
            summary.total_costs -= gross_value
        
        summary.profit = summary.total_sales - summary.total_costs
        summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs
        
        db.session.commit()

@app.route('/get-simple-expense/<int:expense_id>')
@login_required
def get_simple_expense(expense_id):
    try:
        expense = SimpleExpenses.query.get_or_404(expense_id)
        
        expense_dict = {
            'id': expense.id,
            'transaction_type': expense.transaction_type,
            'description': expense.description,
            'gross_value': expense.gross_value,
            'iva_rate': expense.iva_rate,
            'iva_value': expense.iva_value,
            'net_value': expense.net_value,
            'company_id': expense.company_id 
        }
        
        return jsonify({'success': True, 'expense': expense_dict})
        
    except Exception as e:
        return jsonify({'success': False, 'message': str(e)}), 500

@app.route('/update-simple-expense/<int:expense_id>', methods=['POST'])
@login_required
def update_simple_expense(expense_id):
    try:
        expense = SimpleExpenses.query.get_or_404(expense_id)
        
        company_id = request.form.get('company_id')
        if not company_id:
            company_id = expense.company_id
        
        if expense.user_id != current_user.id and current_user.type != 'Admin':
            flash('❌ Você não tem permissão para editar esta transação.', 'error')
            return redirect(url_for('simple_sales', company_id=company_id))
        
        old_transaction_type = expense.transaction_type
        old_gross_value = expense.gross_value
        old_net_value = expense.net_value
        old_iva_value = expense.iva_value
        
        expense.transaction_type = request.form.get('transaction_type')
        expense.description = request.form.get('description')
        expense.gross_value = float(request.form.get('gross_value'))
        expense.iva_rate = float(request.form.get('iva_rate'))
        expense.iva_value = float(request.form.get('iva_value'))
        expense.net_value = float(request.form.get('net_value'))
        
        db.session.commit()
        
        adjust_simple_monthly_summary(
            expense,
            old_transaction_type,
            old_gross_value,
            old_net_value,
            old_iva_value
        )
        
        flash('✅ Transação atualizada com sucesso!', 'success')
        return redirect(url_for('simple_sales', company_id=company_id))
        
    except Exception as e:
        db.session.rollback()
        
        company_id = request.form.get('company_id')
        if not company_id and expense:
            company_id = expense.company_id
            
        flash(f'❌ Erro ao atualizar transação: {str(e)}', 'error')
        
        if company_id:
            return redirect(url_for('simple_sales', company_id=company_id))
        else:
            return redirect(url_for('company'))

def adjust_simple_monthly_summary(expense, old_type, old_gross, old_net, old_iva):
    transaction_date = expense.create_date
    month = transaction_date.month
    year = transaction_date.year
    
    summary = SimpleMonthlySummary.query.filter_by(
        month=month, 
        year=year,
        company_id=expense.company_id
    ).first()
    
    if not summary:
        summary = SimpleMonthlySummary(
            month=month,
            year=year,
            company_id=expense.company_id
        )
        db.session.add(summary)
        
        if expense.transaction_type.lower() == 'ganho':
            summary.total_sales += expense.gross_value
            summary.total_sales_without_vat += expense.net_value
            summary.total_vat += expense.iva_value
        elif expense.transaction_type.lower() == 'despesa':
            summary.total_costs += expense.gross_value
    else:
        if old_type.lower() == 'ganho':
            summary.total_sales -= old_gross
            summary.total_sales_without_vat -= old_net
            summary.total_vat -= old_iva
        elif old_type.lower() == 'despesa':
            summary.total_costs -= old_gross
        
        if expense.transaction_type.lower() == 'ganho':
            summary.total_sales += expense.gross_value
            summary.total_sales_without_vat += expense.net_value
            summary.total_vat += expense.iva_value
        elif expense.transaction_type.lower() == 'despesa':
            summary.total_costs += expense.gross_value
    
    summary.profit = summary.total_sales - summary.total_costs
    summary.profit_without_vat = summary.total_sales_without_vat - summary.total_costs
    
    db.session.commit()

@app.route('/api/simple-financial-summary')
@login_required
def api_simple_financial_summary():
    try:
        company_id = request.args.get('company_id', type=int)
        month = request.args.get('month', type=int)
        year = request.args.get('year', type=int)
        
        if not all([company_id, month, year]):
            return jsonify({
                'success': False,
                'message': 'Parâmetros inválidos'
            }), 400
            
        summary = SimpleMonthlySummary.query.filter_by(
            company_id=company_id,
            month=month,
            year=year
        ).first()
        
        if not summary:
            expenses = SimpleExpenses.query.filter(
                SimpleExpenses.company_id == company_id,
                db.extract('month', SimpleExpenses.create_date) == month,
                db.extract('year', SimpleExpenses.create_date) == year
            ).all()
            
            total_sales = 0.0
            total_sales_without_vat = 0.0
            total_vat = 0.0
            total_costs = 0.0
            
            for expense in expenses:
                if expense.transaction_type.lower() == 'ganho':
                    total_sales += expense.gross_value
                    total_sales_without_vat += expense.net_value
                    total_vat += expense.iva_value
                elif expense.transaction_type.lower() == 'despesa':
                    total_costs += expense.gross_value
            
            summary_data = {
                'total_sales': total_sales,
                'total_sales_without_vat': total_sales_without_vat,
                'total_vat': total_vat,
                'total_costs': total_costs,
                'profit': total_sales - total_costs,
                'profit_without_vat': total_sales_without_vat - total_costs
            }
        else:
            summary_data = {
                'total_sales': summary.total_sales,
                'total_sales_without_vat': summary.total_sales_without_vat,
                'total_vat': summary.total_vat,
                'total_costs': summary.total_costs,
                'profit': summary.profit,
                'profit_without_vat': summary.profit_without_vat
            }
        
        prev_month = month - 1
        prev_year = year
        
        if prev_month == 0:
            prev_month = 12
            prev_year -= 1
            
        prev_summary = SimpleMonthlySummary.query.filter_by(
            company_id=company_id,
            month=prev_month,
            year=prev_year
        ).first()
        
        if prev_summary:
            if prev_summary.total_sales > 0:
                summary_data['sales_change'] = ((summary_data['total_sales'] - prev_summary.total_sales) / prev_summary.total_sales) * 100
            
            if prev_summary.total_costs > 0:
                summary_data['costs_change'] = ((summary_data['total_costs'] - prev_summary.total_costs) / prev_summary.total_costs) * 100
            
            if prev_summary.profit > 0:
                summary_data['profit_change'] = ((summary_data['profit'] - prev_summary.profit) / prev_summary.profit) * 100
            
            if prev_summary.total_vat > 0:
                summary_data['vat_change'] = ((summary_data['total_vat'] - prev_summary.total_vat) / prev_summary.total_vat) * 100
        
        return jsonify({
            'success': True,
            'summary': summary_data
        })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar dados financeiros: {str(e)}'
        }), 500
    
@app.route('/settings/<company_id>')
@login_required
def settings(company_id):    
    settings_obj = Settings.query.filter_by(company_id=company_id).first()
    
    is_admin = current_user.type == "Admin"
    
    return render_template('settings.html', company_id=company_id, settings=settings_obj, is_admin=is_admin)

@app.route('/get-settings/<company_id>')
@login_required
def get_settings(company_id):
    try:
        company = Company.query.get_or_404(company_id)
        
        settings = Settings.query.filter_by(company_id=company_id).first()
        
        if settings:
            settings_data = {
                'total_insurance_value': settings.total_insurance_value,
                'rent_value': settings.rent_value,
                'employee_insurance_value': settings.employee_insurance_value,
                'preferred_salary_expense_day': settings.preferred_salary_expense_day
            }
            
            return jsonify({
                'success': True,
                'settings': settings_data
            })
        else:
            return jsonify({
                'success': True,
                'settings': {
                    'total_insurance_value': 0.0,
                    'rent_value': 0.0,
                    'employee_insurance_value': 0.0,
                    'preferred_salary_expense_day': 1
                }
            })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar configurações: {str(e)}'
        }), 500

@app.route('/save-settings', methods=['POST'])
@login_required
def save_settings():
    try:
        company_id = request.form.get('company_id')
        
        if not company_id:
            return jsonify({
                'success': False,
                'message': 'ID da empresa não fornecido.'
            }), 400
            
        settings = Settings.query.filter_by(company_id=company_id).first()
        
        if not settings:
            settings = Settings(company_id=company_id)
            db.session.add(settings)
        
        settings.total_insurance_value = float(request.form.get('total_insurance_value', 0.0))
        settings.rent_value = float(request.form.get('rent_value', 0.0))
        settings.employee_insurance_value = float(request.form.get('employee_insurance_value', 0.0))
        settings.preferred_salary_expense_day = int(request.form.get('preferred_salary_expense_day', 1))
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Configurações salvas com sucesso!'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar configurações: {str(e)}'
        }), 500
    
def get_actual_salary_day(preferred_day, current_month, current_year):
    if preferred_day == 99:
        return calendar.monthrange(current_year, current_month)[1]
    else:
        return min(preferred_day, 28)

@app.route('/get-info-settings')
@login_required
def get_info_settings():
    try:
        
        info = Info.query.first()
        
        if info:
            info_data = {
                'payment_vps_date': info.payment_vps_date.strftime('%Y-%m-%d') if info.payment_vps_date else None,
                'subscription_type_vps': info.subscription_type_vps
            }
            
            return jsonify({
                'success': True,
                'info': info_data
            })
        else:
            return jsonify({
                'success': True,
                'info': {
                    'payment_vps_date': None,
                    'subscription_type_vps': 'mensal'
                }
            })
        
    except Exception as e:
        return jsonify({
            'success': False,
            'message': f'Erro ao buscar configurações: {str(e)}'
        }), 500

@app.route('/save-info-settings', methods=['POST'])
@login_required
def save_info_settings():
    try:
        if current_user.type != "Admin":
            return jsonify({
                'success': False,
                'message': 'Apenas administradores podem salvar configurações.'
            }), 403
                
        payment_vps_date = request.form.get('payment_vps_date')
        subscription_type_vps = request.form.get('subscription_type_vps')
        
        if payment_vps_date:
            payment_vps_date = datetime.strptime(payment_vps_date, '%Y-%m-%d').date()
        
        info = Info.query.first()
        
        if not info:
            info = Info(payment_vps_date=payment_vps_date, 
                       subscription_type_vps=subscription_type_vps)
            db.session.add(info)
        else:
            info.payment_vps_date = payment_vps_date
            info.subscription_type_vps = subscription_type_vps
        
        db.session.commit()
        
        return jsonify({
            'success': True,
            'message': 'Configurações salvas com sucesso!'
        }), 200
        
    except Exception as e:
        db.session.rollback()
        return jsonify({
            'success': False,
            'message': f'Erro ao salvar configurações: {str(e)}'
        }), 500
    
@app.route('/smodal')
@login_required
def smodal():
    try:
        if session.get('expiration_warning_shown', False):
            return jsonify({'show': False})
        
        info = Info.query.first()
        
        if not info or not info.payment_vps_date:
            return jsonify({'show': False})
        
        today = datetime.now().date()
        payment_date = info.payment_vps_date
        days_remaining = (payment_date - today).days
        
        if days_remaining <= 30:
            session['expiration_warning_shown'] = True
            
            if days_remaining >= 0:
                return jsonify({
                    'show': True,
                    'title': 'Aviso de Expiração',
                    'type': 'warning',
                    'content': f'''
                        <div class="modal-warning">
                            <p><strong>A sua subscrição expira em {days_remaining} dias.</strong></p>
                            <p>Para garantir a continuidade do acesso aos seus dados e funcionalidades, 
                            por favor entre em contacto com o nosso suporte técnico.</p>
                            <p>Telefone: +351 965 567 916</p>
                        </div>
                    '''
                })
            else:
                return jsonify({
                    'show': True,
                    'title': 'Subscrição Expirada',
                    'type': 'error',
                    'content': f'''
                        <div class="modal-error">
                            <p><strong>A sua subscrição expirou há {abs(days_remaining)} dias.</strong></p>
                            <p>O acesso aos seus dados e funcionalidades pode ser interrompido a qualquer momento.</p>
                            <p>Telefone: +351 965 567 916</p>
                        </div>
                    '''
                })
        
        return jsonify({'show': False})
        
    except Exception as e:
        print(f"Erro ao verificar data de expiração: {str(e)}")
        return jsonify({'show': False})

if __name__ == '__main__':
    with app.app_context():
        db_path = os.path.join(basedir, 'instance', 'test.db')
        db_exists = os.path.isfile(db_path)
        if not db_exists:
            db.create_all()
            
        try:
            run_auto_migration(app)
        except Exception as e:
            print("Continuing with initialization...")
        
        install_core()
        start_day_checker(app)
    app.run(debug=True, host='0.0.0.0', port=5000)