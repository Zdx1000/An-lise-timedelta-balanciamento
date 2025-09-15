import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

class Servidor:
    def __init__(self, inicial_nome: str = None, list_colunas: list = None):
        self.nome = inicial_nome
        self.colunas = list_colunas if list_colunas else []

        def carregar_dados(self, caminho_arquivo: str = None) -> pd.DataFrame:
            # Se não fornecer caminho, tenta abrir o arquivo xlsx com inicial_nome na mesma pasta
            if not caminho_arquivo:
                pasta_atual = os.path.dirname(os.path.abspath(__file__))
                caminho_arquivo = os.path.join(pasta_atual, f"{self.nome}.xlsx")
            if os.path.exists(caminho_arquivo):
                try:
                    dados = pd.read_excel(caminho_arquivo)
                    return dados[self.colunas]
                except Exception as e:
                    print(f"Erro ao carregar o arquivo: {e}")
                    return pd.DataFrame()
            else:
                print("Caminho do arquivo inválido ou não encontrado.")
                return pd.DataFrame()
            
        dados_xlsx = carregar_dados(self)
        print(dados_xlsx)

        


if __name__ == "__main__":
    print("Iniciando Servidor...")
    servidor = Servidor("Contaulta", ["Descrição Atividade", "Data", "Tempo de Execução", "Nome Separador",
                                       "Container", "Carga", "Área", "Tipo Área", "Endereço", "Item", "Qtd Sep."])