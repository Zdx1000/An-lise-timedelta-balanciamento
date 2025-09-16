import tkinter as tk
from tkinter import ttk, messagebox
import subprocess
import threading
import webbrowser
import time
import requests

SERVIDOR_CMD = ['python', 'servidor.py']
SERVIDOR_URL = 'http://127.0.0.1:5000/'


class PainelServidor(tk.Tk):
    def __init__(self):
        super().__init__()
        self.title('Painel de Inicialização do Servidor')
        self.geometry('420x260')
        self.resizable(False, False)
        self.servidor_proc = None
        self.status_var = tk.StringVar(value='Servidor parado')
        self.status_color = '#555'
        self.progress_value = tk.IntVar(value=0)
        self.progress_max = 60
        self.create_widgets()

    def create_widgets(self):
        frm = ttk.Frame(self, padding=18)
        frm.pack(fill='both', expand=True)

        ttk.Label(frm, text='Painel de Inicialização', font=('Segoe UI', 15, 'bold'), foreground='#143956').pack(pady=(0,10))

        self.btn_iniciar = ttk.Button(frm, text='Iniciar Servidor', command=self.iniciar_servidor)
        self.btn_iniciar.pack(fill='x', pady=4)

        self.progress = ttk.Progressbar(frm, orient='horizontal', length=320, mode='determinate', variable=self.progress_value, maximum=self.progress_max)
        self.progress.pack(pady=6)
        self.progress.pack_forget()

        self.loading_label = ttk.Label(frm, text='Aguardando servidor iniciar...', font=('Segoe UI', 10), foreground='#1f4e79')
        self.loading_label.pack(pady=2)
        self.loading_label.pack_forget()

        link_frame = ttk.Frame(frm)
        link_frame.pack(fill='x', pady=10)
        ttk.Label(link_frame, text='Acesse:', font=('Segoe UI', 10)).pack(side='left')
        self.link_entry = ttk.Entry(link_frame, width=30)
        self.link_entry.insert(0, SERVIDOR_URL)
        self.link_entry.pack(side='left', padx=6)
        self.btn_abrir = ttk.Button(link_frame, text='Abrir no navegador', command=self.abrir_navegador)
        self.btn_abrir.pack(side='left')

        self.status_label = ttk.Label(frm, textvariable=self.status_var, font=('Segoe UI', 11, 'bold'))
        self.status_label.pack(pady=10)
        self._update_status_color()

    def iniciar_servidor(self):
        if self.servidor_proc and self.servidor_proc.poll() is None:
            messagebox.showinfo('Servidor', 'Servidor já está em execução.')
            return
        self.status_var.set('Iniciando servidor...')
        self.status_color = '#1f4e79'
        self._update_status_color()
        self.btn_iniciar.config(state='disabled')
        self.loading_label.pack()
        self.progress_value.set(0)
        self.progress.pack()
        threading.Thread(target=self._start_servidor, daemon=True).start()

    def _start_servidor(self):
        try:
            self.servidor_proc = subprocess.Popen(SERVIDOR_CMD)
            self._aguardar_servidor()
        except Exception as e:
            self.status_var.set(f'Erro ao iniciar: {e}')
            self.status_color = '#c62828'
            self._update_status_color()
            self.btn_iniciar.config(state='normal')
            self.loading_label.pack_forget()
            self.progress.pack_forget()

    def _aguardar_servidor(self):
        for i in range(self.progress_max): # até 60 tentativas (~60s)
            self.progress_value.set(i+1)
            try:
                resp = requests.get(SERVIDOR_URL, timeout=1)
                if resp.status_code == 200:
                    self.status_var.set('Servidor iniciado!')
                    self.status_color = '#2e7d32'
                    self._update_status_color()
                    self.loading_label.pack_forget()
                    self.progress.pack_forget()
                    self.btn_iniciar.config(state='disabled')
                    return
            except Exception:
                pass
            self.status_var.set(f'Aguardando servidor... ({i+1}s)')
            self.status_color = '#1f4e79'
            self._update_status_color()
            time.sleep(1)
        self.status_var.set('Falha ao iniciar servidor.')
        self.status_color = '#c62828'
        self._update_status_color()
        self.btn_iniciar.config(state='normal')
        self.loading_label.pack_forget()
        self.progress.pack_forget()

    def abrir_navegador(self):
        webbrowser.open(SERVIDOR_URL)

    def _update_status_color(self):
        self.status_label.config(foreground=self.status_color)

if __name__ == '__main__':
    app = PainelServidor()
    app.mainloop()
