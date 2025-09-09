import threading
import time
import datetime
import logging
from salary_automation import check_and_process_salaries

logger = logging.getLogger('day_checker')
logger.setLevel(logging.INFO)
formatter = logging.Formatter('%(asctime)s - %(name)s - %(levelname)s - %(message)s')
handler = logging.StreamHandler()
handler.setFormatter(formatter)
logger.addHandler(handler)

def print_current_day_loop(app=None):
    
    while True:
        current_date = datetime.datetime.now()
        print(f"\nData atual: {current_date.strftime('%d/%m/%Y %H:%M:%S')}")
        print(f"Dia do mês: {current_date.day}")
        
        if app:
            check_and_process_salaries(app)
        
        time.sleep(10) 

def start_day_checker(app=None):
    day_checker_thread = threading.Thread(target=print_current_day_loop, args=(app,))
    day_checker_thread.daemon = True
    day_checker_thread.start()
    logger.info("Verificador de data iniciado em segundo plano.")
    return day_checker_thread

if __name__ == "__main__":
    print("Executando verificador de data no modo independente.")
    print("Pressione Ctrl+C para encerrar.")
    
    try:
        print_current_day_loop()
    except KeyboardInterrupt:
        print("\nVerificador de data encerrado pelo usuário.")