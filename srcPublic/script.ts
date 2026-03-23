const input = document.getElementById('userInput') as HTMLInputElement;
  const bubble = document.getElementById('msgBubble') as HTMLElement;
  const msgText = document.getElementById('msgText') as HTMLElement;
  const mapFrame = document.getElementById('mapFrame') as HTMLIFrameElement;
  const sendBtn = document.getElementById('sendBtn') as HTMLButtonElement;
  const roadmappill = document.getElementById('roadmap-pill') as HTMLElement;
  const satellitepill = document.getElementById('satellite-pill') as HTMLElement;
  const terrainpill = document.getElementById('terrain-pill') as HTMLElement;
  const systemInfoInput = document.getElementById('systemInfo') as HTMLTextAreaElement;
  const saveSystemBtn = document.getElementById('saveSystemBtn') as HTMLButtonElement;
  let currentMapType = 'roadmap';
    
  sendBtn.addEventListener('click', sendMessage);
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') sendMessage();
  });
  
  saveSystemBtn.addEventListener('click', saveSystemInfo);

  roadmappill.addEventListener('click', () => setView('roadmap', roadmappill));
  satellitepill.addEventListener('click', () => setView('satellite', satellitepill));
  terrainpill.addEventListener('click', () => setView('terrain', terrainpill));
  
  async function saveSystemInfo() {
    const systemInfo = systemInfoInput.value.trim();
    if (!systemInfo) {
      alert('Por favor, introduce información del sistema');
      return;
    }
    
    try {
      const response = await fetch('/system-info', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ systemInfo })
      });
      
      if (response.ok) {
        alert('Información del sistema guardada correctamente');
        saveSystemBtn.textContent = '✓ Información guardada';
        saveSystemBtn.style.background = 'rgba(200,255,87,0.4)';
        setTimeout(() => {
          saveSystemBtn.textContent = 'Guardar Información';
          saveSystemBtn.style.background = 'rgba(200,255,87,0.2)';
        }, 2000);
      } else {
        alert('Error al guardar la información del sistema');
      }
    } catch (error) {
      alert('Error de conexión: ' + error);
    }
  }

  async function sendMessage() {
    const val = input.value.trim();
    if (!val) return;

    // Show message bubble
    msgText.textContent = val;
    bubble.classList.remove('visible');
    void bubble.offsetWidth; // reflow for re-animation
    bubble.classList.add('visible');
    
    // Send question to server
    try {
      const response = await fetch('/consulta', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ pregunta: val })
      });
      
      if (response.ok) {
        const data = await response.json();
        const resposta = data.resposta;
        
        // Update map with the response (which might contain a location)
        const encoded = encodeURIComponent(resposta);
        mapFrame.src = `https://maps.google.com/maps?q=${encoded}&output=embed&z=13&maptype=${currentMapType}`;
        
        // Update message with the response
        msgText.textContent = resposta;
      } else {
        const errorData = await response.json();
        msgText.textContent = 'Error: ' + (errorData.error || 'Unknown error');
      }
    } catch (error) {
      msgText.textContent = 'Error de conexión: ' + error;
    }

    input.value = '';
    input.focus();
  }

  function setView(type : string, el : HTMLElement) {
    currentMapType = type;
    document.querySelectorAll('.map-pill').forEach(p => p.classList.remove('active'));
    el.classList.add('active');

    // Reload map with new type if there's content in bubble
    const current = msgText.textContent;
    if (current) {
      const encoded = encodeURIComponent(current);
      mapFrame.src = `https://maps.google.com/maps?q=${encoded}&output=embed&z=13&maptype=${type}`;
    } else {
      // If no current location, just set map type for future queries
      mapFrame.src = `https://maps.google.com/maps?q=Barcelona,España&output=embed&z=13&maptype=${type}`;
    }
  }