MiniBall v22.8 — naprawa przycisków po usunięciu górnego paska.
Przyczyną był odwołujący się do nieistniejącego elementu exitToMenu kod, który zatrzymywał inicjalizację JS.
Naprawiono: Gra solo, Tryb treningowy, Opuść w lobby, Rozpocznij mecz. Wyjście z meczu jest dostępne w menu ☰.
Zachowano pełnoekranowy układ bez przewijania, rozgrzewkę i wszystkie dotychczasowe ustawienia.
Uruchom: npm install, npm start. Po podmianie Ctrl+F5.

MiniBall v22.9: Zapętlone rozmyte wideo na pełnym ekranie jako tło menu i lobby. Plik miniball_gameplay_background.mp4 musi znajdować się obok index.html.

MiniBall v23.0: poprawiona obsługa pliku MP4 przez server.js (w tym żądania Range), jaśniejsze tło. Wszystkie pliki trzymaj razem w katalogu MiniBall_Multiplayer. Uruchom npm install i npm start; następnie Ctrl+F5.

MiniBall v23.1: zmiana stadionu w Personalizacji podczas meczu (host synchronizuje z gośćmi), Ball Roll 1,5s, sprint 2s, regeneracja 6s, spowolnienie po wślizgu 75% normalnej prędkości, anulowanie naładowanego Power Shota po 2s przytrzymania.
