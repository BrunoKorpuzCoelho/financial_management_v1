import logging
import datetime
import calendar
from sqlalchemy import extract, and_
from instance.base import Company, Settings, Employee, Expenses, MonthlySummary
from flask import current_app
from extensions import db

logger = logging.getLogger('salary_automation')
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)

def check_and_process_salaries(app):
    with app.app_context():
        
        current_date = datetime.datetime.now()
        current_day = current_date.day
        current_month = current_date.month
        current_year = current_date.year
        
        logger.info(f"Verificando automação de despesas fixas: data atual {current_date.strftime('%d/%m/%Y')}")
        
        companies = Company.query.filter_by(is_active=True).all()
        
        if not companies:
            logger.info("Nenhuma empresa ativa encontrada para processar despesas fixas.")
            return
        
        for company in companies:
            try:
                settings = Settings.query.filter_by(company_id=company.id).first()
                
                if not settings:
                    logger.warning(f"Empresa {company.id} ({company.name}) não possui configurações definidas.")
                    continue
                
                preferred_day = settings.preferred_salary_expense_day
                
                if preferred_day == 99:
                    salary_day = calendar.monthrange(current_year, current_month)[1]
                else:
                    salary_day = min(preferred_day, 28)
                
                if current_day == salary_day:
                    logger.info(f"Hoje é dia de lançamento de despesas fixas para empresa {company.id} ({company.name})")
                    process_company_expenses(company, settings, current_date, db)
                else:
                    logger.debug(f"Hoje não é dia de lançamento de despesas fixas para empresa {company.id} ({company.name}). "
                                f"Configurado para dia {salary_day}, hoje é dia {current_day}.")
            
            except Exception as e:
                logger.error(f"Erro ao processar despesas fixas da empresa {company.id}: {str(e)}")

def process_company_expenses(company, settings, current_date, db):
    
    logger.info(f"Processando despesas fixas para empresa {company.id} ({company.name})")
    
    current_month = current_date.month
    current_year = current_date.year
    
    monthly_summary = MonthlySummary.query.filter_by(
        month=current_month, 
        year=current_year,
        company_id=company.id
    ).first()
    
    if not monthly_summary:
        monthly_summary = MonthlySummary(
            month=current_month,
            year=current_year,
            company_id=company.id
        )
        db.session.add(monthly_summary)
        db.session.flush()
    
    process_company_salaries(company, current_date, monthly_summary, db)
    
    process_company_rent(company, settings, current_date, monthly_summary, db)
    
    process_employee_insurance(company, settings, current_date, monthly_summary, db)
    
    process_company_insurance(company, settings, current_date, monthly_summary, db)
    
    process_other_expenses(company, settings, current_date, monthly_summary, db)
    
    try:
        db.session.commit()
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao finalizar processamento de despesas fixas: {str(e)}")

def process_company_salaries(company, current_date, monthly_summary, db):
    
    logger.info(f"Processando salários para empresa {company.id} ({company.name})")
    
    active_employees = Employee.query.filter_by(company_id=company.id, is_active=True).all()
    
    if not active_employees:
        logger.info(f"Empresa {company.id} não tem funcionários ativos.")
        return
    
    logger.info(f"Encontrados {len(active_employees)} funcionários ativos na empresa {company.id}")
    
    current_month = current_date.month
    current_year = current_date.year
    
    salary_count = Expenses.query.filter(
        and_(
            Expenses.company_id == company.id,
            Expenses.description.like("Salário:%"),
            extract('month', Expenses.create_date) == current_month,
            extract('year', Expenses.create_date) == current_year
        )
    ).count()
    
    if salary_count >= len(active_employees):
        logger.info(f"Salários já foram processados para todos os {len(active_employees)} funcionários ativos da empresa {company.id} neste mês.")
        return
    
    newly_added_salaries = 0
    expenses_created = []  
    
    for employee in active_employees:
        try:
            existing_salary = Expenses.query.filter(
                and_(
                    Expenses.company_id == company.id,
                    Expenses.description.like(f"Salário: {employee.name}%"),
                    extract('month', Expenses.create_date) == current_month,
                    extract('year', Expenses.create_date) == current_year
                )
            ).first()
            
            if existing_salary:
                logger.info(f"Salário já registrado este mês para {employee.name} (ID: {employee.id})")
                continue  
            
            gross_value = employee.gross_salary
            
            if employee.extra_payment > 0:
                gross_value += employee.extra_payment
                extra_info = f" + {employee.extra_payment}€ ({employee.extra_payment_description})" if employee.extra_payment_description else f" + {employee.extra_payment}€"
            else:
                extra_info = ""
            
            newly_added_salaries += gross_value
            
            description = f"Salário: {employee.name} - {employee.position}{extra_info}"
            
            new_expense = Expenses(
                transaction_type="despesa",
                description=description,
                gross_value=gross_value,
                iva_rate=0,  
                iva_value=0,
                net_value=gross_value,
                user_id=company.user_id,  
                company_id=company.id
            )
            
            db.session.add(new_expense)
            expenses_created.append(new_expense)
            logger.info(f"Criado registro de salário para {employee.name}: {gross_value}€")
            
        except Exception as e:
            logger.error(f"Erro ao processar salário do funcionário {employee.id}: {str(e)}")
            continue
    
    if newly_added_salaries > 0:
        monthly_summary.total_employee_salaries += newly_added_salaries
        monthly_summary.total_costs += newly_added_salaries
        
        monthly_summary.profit = monthly_summary.total_sales - monthly_summary.total_costs
        monthly_summary.profit_without_vat = monthly_summary.total_sales_without_vat - monthly_summary.total_costs
        
        logger.info(f"Adicionado {newly_added_salaries}€ em novos salários ao resumo mensal.")
    else:
        logger.info("Nenhum novo salário para adicionar ao resumo mensal.")
    
    try:
        db.session.commit()
        if expenses_created:
            logger.info(f"Processados {len(expenses_created)} novos salários para a empresa {company.id}")
            logger.info(f"Total de novos salários adicionados: {newly_added_salaries}€")
        else:
            logger.info("Nenhum novo registro de salário criado.")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao salvar os registros de salários: {str(e)}")

def process_company_rent(company, settings, current_date, monthly_summary, db):
    logger.info(f"Processando renda para empresa {company.id} ({company.name})")
    
    if settings.rent_value <= 0:
        logger.info(f"Empresa {company.id} não tem valor de renda configurado.")
        return
    
    current_month = current_date.month
    current_year = current_date.year
    
    existing_rent = Expenses.query.filter(
        and_(
            Expenses.company_id == company.id,
            Expenses.description == "Renda mensal do espaço",
            extract('month', Expenses.create_date) == current_month,
            extract('year', Expenses.create_date) == current_year
        )
    ).first()
    
    if existing_rent:
        logger.info(f"Renda já registrada este mês para a empresa {company.id}")
        return
    
    rent_value = settings.rent_value
    iva_rate = 23.0  # Taxa de IVA de 23% para renda
    
    # Cálculo correto do IVA e valor líquido
    net_value = round(rent_value / 1.23, 2)  # Valor líquido (sem IVA)
    iva_value = round(rent_value - net_value, 2)  # Valor do IVA
    
    new_expense = Expenses(
        transaction_type="despesa",
        description="Renda mensal do espaço",
        gross_value=rent_value,
        iva_rate=iva_rate,
        iva_value=iva_value,
        net_value=net_value,
        user_id=company.user_id,  
        company_id=company.id
    )
    
    db.session.add(new_expense)
    
    # Atualizar os totais do resumo mensal
    monthly_summary.total_costs += rent_value
    monthly_summary.total_costs_without_vat += net_value
    monthly_summary.total_vat -= iva_value  # Subtrair IVA (pois é uma despesa)
    
    monthly_summary.profit = monthly_summary.total_sales - monthly_summary.total_costs
    monthly_summary.profit_without_vat = monthly_summary.total_sales_without_vat - monthly_summary.total_costs_without_vat
    
    try:
        db.session.commit()
        logger.info(f"Registrada renda mensal para empresa {company.id}: {rent_value}€ (IVA: {iva_value}€)")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao registrar renda mensal: {str(e)}")

def process_employee_insurance(company, settings, current_date, monthly_summary, db):
    logger.info(f"Processando seguros dos empregados para empresa {company.id} ({company.name})")
    
    if settings.employee_insurance_value <= 0:
        logger.info(f"Empresa {company.id} não tem valor de seguros dos empregados configurado.")
        return
    
    current_month = current_date.month
    current_year = current_date.year
    
    existing_insurance = Expenses.query.filter(
        and_(
            Expenses.company_id == company.id,
            Expenses.description == "Seguros dos Empregados",
            extract('month', Expenses.create_date) == current_month,
            extract('year', Expenses.create_date) == current_year
        )
    ).first()
    
    if existing_insurance:
        logger.info(f"Seguros dos empregados já registrados este mês para a empresa {company.id}")
        return
    
    insurance_value = settings.employee_insurance_value
    
    new_expense = Expenses(
        transaction_type="despesa",
        description="Seguros dos Empregados",
        gross_value=insurance_value,
        iva_rate=0,
        iva_value=0,
        net_value=insurance_value,
        user_id=company.user_id,
        company_id=company.id
    )
    
    db.session.add(new_expense)
    
    monthly_summary.total_costs += insurance_value
    monthly_summary.total_employee_insurance += insurance_value
    
    monthly_summary.profit = monthly_summary.total_sales - monthly_summary.total_costs
    monthly_summary.profit_without_vat = monthly_summary.total_sales_without_vat - monthly_summary.total_costs
    
    try:
        db.session.commit()
        logger.info(f"Registrados seguros dos empregados para empresa {company.id}: {insurance_value}€")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao registrar seguros dos empregados: {str(e)}")

def process_company_insurance(company, settings, current_date, monthly_summary, db):
    logger.info(f"Processando seguros da empresa {company.id} ({company.name})")
    
    if settings.total_insurance_value <= 0:
        logger.info(f"Empresa {company.id} não tem valor de seguros configurado.")
        return
    
    current_month = current_date.month
    current_year = current_date.year
    
    # CORREÇÃO AQUI: usar a mesma descrição na verificação e na criação
    existing_insurance = Expenses.query.filter(
        and_(
            Expenses.company_id == company.id,
            Expenses.description == "Seguros da Empresa",  # CORRIGIDO
            extract('month', Expenses.create_date) == current_month,
            extract('year', Expenses.create_date) == current_year
        )
    ).first()
    
    if existing_insurance:
        logger.info(f"Seguros da empresa já registrados este mês para a empresa {company.id}")
        return
    
    insurance_value = settings.total_insurance_value
    
    new_expense = Expenses(
        transaction_type="despesa",
        description="Seguros da Empresa",
        gross_value=insurance_value,
        iva_rate=0,
        iva_value=0,
        net_value=insurance_value,
        user_id=company.user_id,
        company_id=company.id
    )
    
    db.session.add(new_expense)
    
    monthly_summary.total_costs += insurance_value
    
    monthly_summary.profit = monthly_summary.total_sales - monthly_summary.total_costs
    monthly_summary.profit_without_vat = monthly_summary.total_sales_without_vat - monthly_summary.total_costs
    
    try:
        db.session.commit()
        logger.info(f"Registrados seguros da empresa {company.id}: {insurance_value}€")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao registrar seguros da empresa: {str(e)}")

def process_other_expenses(company, settings, current_date, monthly_summary, db):
    logger.info(f"Processando outras despesas para empresa {company.id} ({company.name})")
    
    if settings.other_expenses <= 0:
        logger.info(f"Empresa {company.id} não tem valor de outras despesas configurado.")
        return
    
    current_month = current_date.month
    current_year = current_date.year
    
    existing_expense = Expenses.query.filter(
        and_(
            Expenses.company_id == company.id,
            Expenses.description == "Outras Despesas Fixas",
            extract('month', Expenses.create_date) == current_month,
            extract('year', Expenses.create_date) == current_year
        )
    ).first()
    
    if existing_expense:
        logger.info(f"Outras despesas fixas já registradas este mês para a empresa {company.id}")
        return
    
    other_value = settings.other_expenses
    
    new_expense = Expenses(
        transaction_type="despesa",
        description="Outras Despesas Fixas",
        gross_value=other_value,
        iva_rate=0,
        iva_value=0,
        net_value=other_value,
        user_id=company.user_id,
        company_id=company.id
    )
    
    db.session.add(new_expense)
    
    monthly_summary.total_costs += other_value
    
    monthly_summary.profit = monthly_summary.total_sales - monthly_summary.total_costs
    monthly_summary.profit_without_vat = monthly_summary.total_sales_without_vat - monthly_summary.total_costs
    
    try:
        db.session.commit()
        logger.info(f"Registradas outras despesas fixas para empresa {company.id}: {other_value}€")
    except Exception as e:
        db.session.rollback()
        logger.error(f"Erro ao registrar outras despesas fixas: {str(e)}")