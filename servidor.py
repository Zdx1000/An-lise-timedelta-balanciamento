import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import os
from flask import Flask, jsonify, send_from_directory, request
from flask_cors import CORS

class Servidor:
    def __init__(self, inicial_nome: str = None, list_colunas: list = None):
        self.nome = inicial_nome or ""
        self.colunas = list_colunas if list_colunas else []
        self.dados = self.carregar_dados()

    def carregar_dados(self, caminho_arquivo: str = None) -> pd.DataFrame:
        """Carrega dados de um arquivo Excel baseado no prefixo self.nome.
        Retorna DataFrame vazio se não encontrar ou se houver erro.
        """
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
                if self.colunas:
                    # Apenas mantém colunas existentes para evitar erro
                    colunas_validas = [c for c in self.colunas if c in dados.columns]
                    dados = dados[colunas_validas]
                return dados
            except Exception as e:
                print(f"Erro ao ler arquivo: {e}")
                return pd.DataFrame(columns=self.colunas)
        return pd.DataFrame(columns=self.colunas)

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
        return self.dados

    def dinamica(self, x, x2, y, filter: str = None):
        df = self.dados.copy()
        if filter:
            df = df[df["Modulo"] == filter]

        df = pd.pivot_table(df, index=[x, x2], values=y, aggfunc="mean", fill_value=0).reset_index()
        return df

    def gerar_pivot(self, modulo: str | None = None):
        return self.dinamica("Endereço", "Área", "Tempo de Execução", modulo)

    def get_modulos(self):
        if "Modulo" not in self.dados.columns:
            return []
        return sorted(self.dados["Modulo"].dropna().unique().tolist())

    def processar(self):
        if self.converter_coluns():
            self.tratar_dados_tempoDeSeparacao()
        return self.dados

    
    def salvar_arquivo(self, nome_arquivo: str = None):
        with pd.ExcelWriter(nome_arquivo if nome_arquivo else "Metrica.xlsx") as writer:
            self.dados.to_excel(writer, index=True, sheet_name="Metrica")

# --------------------------- API FLASK ---------------------------

def criar_app():
    servidor = Servidor(
        "Consulta_",
        [
            "Descrição Atividade", "Data", "Tempo de Execução", "Nome Separador",
            "Container", "Carga", "Área", "Tipo Área", "Endereço", "Item", "Qtd Sep."
        ]
    )
    servidor.processar()

    app = Flask(__name__, static_folder="Componentes", template_folder="Componentes")
    CORS(app)

    @app.route("/")
    def index():
        return send_from_directory("Componentes", "main.html")

    @app.route("/api/modulos")
    def api_modulos():
        return jsonify({"modulos": servidor.get_modulos()})

    @app.route("/api/dados")
    def api_dados():
        modulo = request.args.get("modulo")
        pivot = servidor.gerar_pivot(modulo)
        # Normaliza para JSON
        registros = pivot.to_dict(orient="records")
        return jsonify({"dados": registros})

    @app.route('/Componentes/<path:filename>')
    def componentes_static(filename):
        return send_from_directory('Componentes', filename)

    return app


if __name__ == "__main__":  # Execução para testes locais
    app = criar_app()
    print("API Flask iniciada em http://127.0.0.1:5000")
    app.run(debug=True)