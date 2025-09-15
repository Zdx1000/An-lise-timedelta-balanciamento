import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

class Servidor:
    def __init__(self, inicial_nome: str = None, list_colunas: list = None):
        self.nome = inicial_nome
        self.colunas = list_colunas if list_colunas else []

        def carregar_dados(self, caminho_arquivo: str = None) -> pd.DataFrame:
            None



        pass


if __name__ == "__main__":
    print("Iniciando Servidor...")
    servidor = Servidor("Contaulta", ["Descrição Atividade", "Data", "Tempo de Execução", "Nome Separador",
                                       "Container", "Carga", "Área", "Tipo Área", "Endereço", "Item", "Qtd Sep."])