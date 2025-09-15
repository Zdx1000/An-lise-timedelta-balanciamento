import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os

class Servidor:
    def __init__(self, inicial_nome: str = None, list_colunas: list = None, dados_xlsx: pd.DataFrame = None):
        self.nome = inicial_nome
        self.colunas = list_colunas if list_colunas else []

        def carregar_dados(self, caminho_arquivo: str = None) -> pd.DataFrame:
            # Se não fornecer caminho, tenta abrir o arquivo xlsx com inicial_nome na mesma pasta
            if not caminho_arquivo:
                pasta_atual = os.path.dirname(os.path.abspath(__file__))
                # Procura um arquivo que começa com self.nome e termina com .xlsx
                arquivos = [f for f in os.listdir(pasta_atual) if f.startswith(self.nome) and f.endswith('.xlsx')]
                if arquivos:
                    caminho_arquivo = os.path.join(pasta_atual, arquivos[0])
                else:
                    caminho_arquivo = os.path.join(pasta_atual, f"{self.nome}.xlsx")
            if os.path.exists(caminho_arquivo):
                try:
                    dados = pd.read_excel(caminho_arquivo)
                    return dados[self.colunas]
                except Exception as e:
                    return pd.DataFrame()
            else:
                return pd.DataFrame()
            
        dados_xlsx = carregar_dados(self)

        self.dados = dados_xlsx if not dados_xlsx.empty else pd.DataFrame(columns=self.colunas)

    def mostrar_dados(self):
        print(self.dados)

    def converter_coluns(self) -> bool:
        try:
            self.dados["Data"] = pd.to_datetime(self.dados["Data"], errors='coerce').dt.date
            self.dados["Tempo de Execução"] = pd.to_datetime(self.dados["Tempo de Execução"].astype(str), format='%H:%M:%S', errors='coerce').dt.time
            return True
        except Exception as e:
            print(f"Erro ao converter colunas: {e}")
            return False

    def tratar_dados_tempoDeSeparacao(self) -> pd.DataFrame:
        # Certifique-se que as colunas necessárias existem
        required_cols = ["Container", "Área", "Endereço", "Tipo Área", "Tempo de Execução"]
        if not all(col in self.dados.columns for col in required_cols):
            print("Colunas necessárias não encontradas.")
            return

        self.dados["Tempo de Execução"] = pd.to_timedelta(self.dados["Tempo de Execução"].astype(str))

        agrupado = self.dados.groupby(["Container", "Área", "Endereço", "Tipo Área"])["Tempo de Execução"].sum().reset_index()

        tempo_medio = agrupado.groupby(["Área", "Endereço", "Tipo Área"])["Tempo de Execução"].mean().reset_index()

        
        tempo_medio["Tempo de Execução"] = tempo_medio["Tempo de Execução"].apply(
            lambda x: x.total_seconds() / 86400 if pd.notnull(x) else 0
        )

        tempo_medio = tempo_medio[tempo_medio["Endereço"].str.count("-") == 2]

        tempo_medio["Modulo"] = tempo_medio["Endereço"].str[:4]

        self.dados = tempo_medio

    def dinamica(self, x, x2, y, filter: str = None):
        if filter:
            self.dados = self.dados[self.dados["Modulo"] == filter]

        self.dados = pd.pivot_table(self.dados, index=[x, x2], values=y, aggfunc="mean", fill_value=0)

    
    def salvar_arquivo(self, nome_arquivo: str = None):
        with pd.ExcelWriter(nome_arquivo if nome_arquivo else "Metrica.xlsx") as writer:
            self.dados.to_excel(writer, index=True, sheet_name="Metrica")



if __name__ == "__main__":
    print("Iniciando Servidor...")
    servidor = Servidor("Consulta_", ["Descrição Atividade", "Data", "Tempo de Execução", "Nome Separador",
                                       "Container", "Carga", "Área", "Tipo Área", "Endereço", "Item", "Qtd Sep."])
    
    valit = servidor.converter_coluns()
    if valit:
        servidor.tratar_dados_tempoDeSeparacao()

        servidor.dinamica("Endereço", "Área", "Tempo de Execução")

    servidor.salvar_arquivo("Metrica_Tempo_de_Separacao.xlsx")