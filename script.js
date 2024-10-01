const API_KEY = 'API KEY'; // Replace with your actual Gemini API key
const API_ENDPOINT = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

let currentBlueprintData = null;

async function simulateLLMResponse(jobTitle) {
    const prompt = `Generate a job blueprint for the position of ${jobTitle}. Include responsibilities, required skills, and qualifications. Format the output as a JSON object with the following structure:
    {
        "jobTitle": "The job title",
        "responsibilities": ["Responsibility 1", "Responsibility 2", ...],
        "requiredSkills": ["Skill 1", "Skill 2", ...],
        "qualifications": ["Qualification 1", "Qualification 2", ...]
    }`;

    try {
        console.log('Sending request to Gemini API...');
        const response = await fetch(`${API_ENDPOINT}?key=${API_KEY}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                contents: [{
                    parts: [{
                        text: prompt
                    }]
                }],
                generationConfig: {
                    temperature: 0.9,
                    topK: 1,
                    topP: 1,
                    maxOutputTokens: 2048,
                }
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();
        console.log('Received response:', data);

        if (!data.candidates || data.candidates.length === 0) {
            throw new Error('No candidates in the response');
        }

        const textContent = data.candidates[0].content.parts[0].text;
        console.log('Extracted text content:', textContent);

        // Attempt to extract JSON from the text content
        const jsonMatch = textContent.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
            try {
                const parsedData = JSON.parse(jsonMatch[0]);
                console.log('Parsed JSON data:', parsedData);
                
                // Validate the structure of the parsed data
                if (!parsedData.jobTitle || !Array.isArray(parsedData.responsibilities) || 
                    !Array.isArray(parsedData.requiredSkills) || !Array.isArray(parsedData.qualifications)) {
                    throw new Error('Parsed data does not have the expected structure');
                }
                
                return parsedData;
            } catch (parseError) {
                console.error('Error parsing JSON:', parseError);
                throw new Error('Failed to parse JSON from API response: ' + parseError.message);
            }
        } else {
            console.error('No JSON object found in the response');
            throw new Error('No valid JSON found in the API response. Raw response: ' + textContent);
        }
    } catch (error) {
        console.error("There was an error calling the Gemini API:", error);
        throw error;
    }
}

function createFeedbackableList(items, sectionName) {
    return items.map((item, index) => `
        <li>
            ${item}
            <button onclick="provideFeedback('${sectionName}', ${index}, true)" class="feedback-btn"><i class="fas fa-thumbs-up"></i></button>
            <button onclick="provideFeedback('${sectionName}', ${index}, false)" class="feedback-btn"><i class="fas fa-thumbs-down"></i></button>
        </li>
    `).join('');
}

function createTable(data) {
    let table = '<table>';
    table += `<tr><th colspan="2">${data.jobTitle}</th></tr>`;
    table += `<tr>
        <td><strong>Responsibilities</strong></td>
        <td>
            <ul>${createFeedbackableList(data.responsibilities, 'responsibilities')}</ul>
        </td>
    </tr>`;
    table += `<tr>
        <td><strong>Required Skills</strong></td>
        <td>
            <ul>${createFeedbackableList(data.requiredSkills, 'requiredSkills')}</ul>
        </td>
    </tr>`;
    table += `<tr>
        <td><strong>Qualifications</strong></td>
        <td>
            <ul>${createFeedbackableList(data.qualifications, 'qualifications')}</ul>
        </td>
    </tr>`;
    table += '</table>';
    return table;
}

async function generateBlueprint() {
    const jobTitle = document.getElementById('job-title').value;
    const outputElement = document.getElementById('blueprint-output');
    const downloadBtn = document.getElementById('download-btn');

    if (!jobTitle) {
        outputElement.innerHTML = "<p>Please enter a job title.</p>";
        downloadBtn.style.display = 'none';
        return;
    }

    outputElement.innerHTML = "<p>Generating blueprint...</p>";
    downloadBtn.style.display = 'none';

    try {
        currentBlueprintData = await simulateLLMResponse(jobTitle);
        if (currentBlueprintData) {
            outputElement.innerHTML = createTable(currentBlueprintData);
            downloadBtn.style.display = 'block';
        } else {
            throw new Error('No data returned from API');
        }
    } catch (error) {
        console.error('Error in generateBlueprint:', error);
        outputElement.innerHTML = `<p>Error generating blueprint: ${error.message}</p>`;
        if (error.message.includes('Raw response:')) {
            outputElement.innerHTML += `<p>API Response:</p><pre>${error.message.split('Raw response:')[1]}</pre>`;
        }
    }
}

function provideFeedback(section, index, isPositive) {
    const jobTitle = document.getElementById('job-title').value;
    const item = currentBlueprintData[section][index];
    const feedbackType = isPositive ? 'positive' : 'negative';
    
    console.log(`${feedbackType} feedback received for ${jobTitle} - ${section}[${index}]: "${item}"`);
    
    // Here you would typically send this feedback to your server or API
    // For now, we'll just show an alert
    alert(`Thank you for your ${feedbackType} feedback on: "${item}"`);
    
    // Optionally, you could visually indicate that feedback was given
    const feedbackButtons = document.querySelectorAll(`#blueprint-output tr:nth-child(${['responsibilities', 'requiredSkills', 'qualifications'].indexOf(section) + 2}) li:nth-child(${index + 1}) .feedback-btn`);
    feedbackButtons.forEach(btn => btn.style.opacity = '0.5');
}

function downloadAsWord() {
    if (!currentBlueprintData) {
        alert("Please generate a blueprint first.");
        return;
    }

    const { Document, Packer, Paragraph, Table, TableRow, TableCell, WidthType } = docx;

    const doc = new Document({
        sections: [{
            properties: {},
            children: [
                new Paragraph({
                    text: currentBlueprintData.jobTitle,
                    heading: 'Heading1'
                }),
                new Paragraph({
                    text: "Responsibilities:",
                    heading: 'Heading2'
                }),
                ...currentBlueprintData.responsibilities.map(r => new Paragraph(r)),
                new Paragraph({
                    text: "Required Skills:",
                    heading: 'Heading2'
                }),
                ...currentBlueprintData.requiredSkills.map(s => new Paragraph(s)),
                new Paragraph({
                    text: "Qualifications:",
                    heading: 'Heading2'
                }),
                ...currentBlueprintData.qualifications.map(q => new Paragraph(q))
            ]
        }]
    });

    Packer.toBlob(doc).then(blob => {
        saveAs(blob, `${currentBlueprintData.jobTitle} Blueprint.docx`);
    });
}
