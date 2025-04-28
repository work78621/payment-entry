let extractedText = "";
let allData = [];
let currentPage = 1;
const rowsPerPage = 10;

// Format date to DD MMM YYYY
function formatDate(inputDate) {
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  const parts = inputDate.split("-");
  if (parts.length !== 3) return inputDate;
  const year = parts[0];
  const month = months[parseInt(parts[1], 10) - 1];
  const day = parts[2];
  return `${day} ${month} ${year}`;
}

function addEntry() {
  const imageFile = document.getElementById('imageUpload').files[0];
  const reader = new FileReader();

  if (imageFile) {
    reader.onload = function(event) {
      sendEntry(event.target.result.split(',')[1], imageFile.name, imageFile.type);
    };
    reader.readAsDataURL(imageFile);
  } else {
    sendEntry(null, null, null);
  }
}

function sendEntry(imageBase64, imageName, imageType) {
  const dateRaw = document.getElementById('date').value;
  const formattedDate = formatDate(dateRaw);

  const row = {
    date: formattedDate,
    ins: document.getElementById('ins').value,
    identifier: document.getElementById('identifier').value,
    transaction: document.getElementById('transaction').value,
    currency: document.getElementById('currency').value,
    amount: parseFloat(document.getElementById('amount').value),
    bank: document.getElementById('bank').value,
    from: document.getElementById('from').value,
    remarks: document.getElementById('remarks').value,
    imageName: imageName,
    imageType: imageType,
    imageBase64: imageBase64
  };

  fetch('https://script.google.com/macros/s/AKfycbygInhj9xPuOQVCp2LhXYme9Fd399n6ZQDAZrPONz8Wk-r8RUYsXwwu1_km0_ufekDTzw/exec', {
    method: 'POST',
    body: JSON.stringify(row)
  })
  .then(response => {
    if (response.ok) {
      alert("✅ Data Saved Successfully!");
      document.getElementById("entryForm").reset();
      setTimeout(fetchSheetData, 1000);
    } else {
      alert("❌ Failed to save! Try again.");
    }
  })
  .catch(error => {
    console.error('Error:', error);
    alert("❌ Error saving data.");
  });
}

function readImage() {
  const file = document.getElementById('fileInput').files[0];
  if (file) {
    Tesseract.recognize(file, 'eng', { logger: m => console.log(m) })
      .then(({ data: { text } }) => {
        extractedText = text;
        document.getElementById('ocrText').textContent = extractedText;
      });
  }
}

function mapTextToForm(sourceText = extractedText) {
  if (!sourceText) {
    alert("No text detected!");
    return;
  }
  const lines = sourceText.split("\n");
  lines.forEach(line => {
    line = line.trim();
    if (line.match(/date/i)) {
      const dateMatch = line.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/);
      if (dateMatch) {
        const parts = dateMatch[0].split(/[\/\-.]/);
        document.getElementById('date').value = `${parts[2]}-${parts[1].padStart(2,'0')}-${parts[0].padStart(2,'0')}`;
      }
    }
    if (line.toLowerCase().includes("amount") || line.toLowerCase().includes("amt")) {
      const amtMatch = line.replace(/,/g, '').match(/\d+(\.\d+)?/);
      if (amtMatch) {
        document.getElementById('amount').value = amtMatch[0];
      }
    }
    if (line.match(/pkr/i)) document.getElementById('currency').value = "PKR";
    if (line.match(/aed/i)) document.getElementById('currency').value = "AED";
    if (line.toLowerCase().includes("from")) {
      const fromText = line.split(":")[1] || line.split(" ")[1];
      if (fromText) document.getElementById('from').value = fromText.trim();
    }
  });
  alert("Auto-filled based on detected text. Please double check before saving!");
}

function mapManualTextToForm() {
  const manualText = document.getElementById('manualText').value;
  if (!manualText) {
    alert("Please paste some text first!");
    return;
  }
  mapTextToForm(manualText);
}

function fetchSheetData() {
  fetch('https://docs.google.com/spreadsheets/d/e/2PACX-1vTlw8qZi3uvvJOfOX-fXsA_vhVYv8NBxRVQqrMQp0sHAT-UVZMu4m90PkNdWJjD8lm3nANr2lMiSzRj/pub?output=csv')
  .then(response => response.text())
  .then(data => {
    allData = data.split("\n").map(row => row.split(","));
    currentPage = 1;
    renderTable();
  })
  .catch(error => {
    console.error('Error fetching sheet data:', error);
  });
}

function renderTable() {
  let tableHTML = "<table><tr>";
  allData[0].forEach(header => { tableHTML += `<th>${header}</th>`; });
  tableHTML += "</tr>";

  let filteredData = allData.slice(1);

  // Search filter
  const searchTerm = document.getElementById('searchInput').value.toLowerCase();
  if (searchTerm) {
    filteredData = filteredData.filter(row => row.join(" ").toLowerCase().includes(searchTerm));
  }

  // Date filter
  const fromDate = document.getElementById('fromDate').value;
  const toDate = document.getElementById('toDate').value;
  if (fromDate || toDate) {
    filteredData = filteredData.filter(row => {
      const entryDate = row[0];
      const [day, monthStr, year] = entryDate.split(" ");
      const months = {Jan:"01",Feb:"02",Mar:"03",Apr:"04",May:"05",Jun:"06",Jul:"07",Aug:"08",Sep:"09",Oct:"10",Nov:"11",Dec:"12"};
      const entryFormatted = `${year}-${months[monthStr]}-${day.padStart(2,'0')}`;
      return (!fromDate || entryFormatted >= fromDate) && (!toDate || entryFormatted <= toDate);
    });
  }

  const start = (currentPage - 1) * rowsPerPage;
  const end = start + rowsPerPage;
  const pageData = filteredData.slice(start, end);

  pageData.forEach(row => {
    tableHTML += "<tr>";
    row.forEach(cell => { tableHTML += `<td>${cell}</td>`; });
    tableHTML += "</tr>";
  });

  tableHTML += "</table>";
  document.getElementById('liveTable').innerHTML = tableHTML;
}

function filterTable() {
  currentPage = 1;
  renderTable();
}

function nextPage() {
  if ((currentPage * rowsPerPage) < (allData.length - 1)) {
    currentPage++;
    renderTable();
  }
}

function prevPage() {
  if (currentPage > 1) {
    currentPage--;
    renderTable();
  }
}

function downloadExcel() {
  const table = document.querySelector("#liveTable table");
  if (!table) {
    alert("No data available to download!");
    return;
  }
  const wb = XLSX.utils.table_to_book(table,
