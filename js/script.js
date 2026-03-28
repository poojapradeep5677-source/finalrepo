// Global State
let currentUser = JSON.parse(localStorage.getItem('nutritrack_user')) || null;
let currentMeals = JSON.parse(localStorage.getItem('nutritrack_meals')) || {
  breakfast: [], lunch: [], dinner: [], snacks: []
};
let currentWater = parseInt(localStorage.getItem('nutritrack_water')) || 0;
let currentActivities = JSON.parse(localStorage.getItem('nutritrack_activity')) || [];
let weightHistory = JSON.parse(localStorage.getItem('nutritrack_weight')) || [];

document.addEventListener('DOMContentLoaded', () => {
    initApp();
});

function initApp() {
    const path = window.location.pathname;
    const isLoginPage = path.endsWith('login.html') || path === '/' && !currentUser;

    if (!currentUser && !isLoginPage) {
        window.location.href = 'login.html';
        return;
    }

    if (currentUser && isLoginPage) {
        window.location.href = 'index.html';
        return;
    }

    // Set Active Nav Link
    document.querySelectorAll('.nav-links a').forEach(link => {
        if(link.getAttribute('href') === path.split('/').pop() || (path.endsWith('/') && link.getAttribute('href') === 'index.html')) {
            link.classList.add('active');
        }
    });

    // Page Specific Initialization
    if (path.endsWith('login.html')) initLogin();
    else if (path.endsWith('index.html') || path.endsWith('/')) initDashboard();
    else if (path.endsWith('meals.html')) initMeals();
    else if (path.endsWith('summary.html')) initSummary();
    else if (path.endsWith('goals.html')) initGoals();
    else if (path.endsWith('progress.html')) initProgress();
}

// Data Handling

function saveUser(userObj) {
    localStorage.setItem('nutritrack_user', JSON.stringify(userObj));
    currentUser = userObj;
}

function saveMeals() {
    localStorage.setItem('nutritrack_meals', JSON.stringify(currentMeals));
}

function saveWater() {
    localStorage.setItem('nutritrack_water', currentWater.toString());
}

function saveActivity() {
    localStorage.setItem('nutritrack_activity', JSON.stringify(currentActivities));
}

function saveWeight() {
    localStorage.setItem('nutritrack_weight', JSON.stringify(weightHistory));
}

function logout() {
    localStorage.removeItem('nutritrack_user');
    window.location.href = 'login.html';
}

function calcBMI(weight, heightStr) {
    const height = parseFloat(heightStr) / 100;
    return (parseFloat(weight) / (height * height)).toFixed(1);
}

function calcBMR(gender, weight, height, age) {
    let bmr = 0;
    const w = parseFloat(weight);
    const h = parseFloat(height);
    const a = parseFloat(age);
    if (gender === 'Male') {
        bmr = 88.362 + (13.397 * w) + (4.799 * h) - (5.677 * a);
    } else {
        bmr = 447.593 + (9.247 * w) + (3.098 * h) - (4.330 * a);
    }
    return Math.round(bmr);
}

function getDailyNutrition() {
    let totals = { cal: 0, pro: 0, carbs: 0, fat: 0 };
    Object.values(currentMeals).forEach(mealArr => {
        mealArr.forEach(f => {
            totals.cal += f.calories;
            totals.pro += f.protein;
            totals.carbs += f.carbs;
            totals.fat += f.fat;
        });
    });
    return totals;
}

function getActivityCalories() {
    return currentActivities.reduce((acc, act) => acc + act.caloriesBurned, 0);
}

// ---------------------- PAGE LOGIC ----------------------

// LOGIN
function initLogin() {
    const form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        const name = document.getElementById('name').value;
        const age = document.getElementById('age').value;
        const height = document.getElementById('height').value;
        const weight = document.getElementById('weight').value;
        const gender = document.getElementById('gender').value;

        const bmi = calcBMI(weight, height);
        const bmr = calcBMR(gender, weight, height, age);
        const calGoal = Math.round(bmr * 1.55); // Moderate activity factor

        const user = { name, age, height, weight, gender, bmi, bmr, calGoal };
        saveUser(user);
        
        // Add initial weight to history
        weightHistory = [{ date: new Date().toISOString().split('T')[0], weight: parseFloat(weight) }];
        saveWeight();

        window.location.href = 'index.html';
    });
}

// DASHBOARD
function initDashboard() {
    if(!document.getElementById('userName')) return;
    
    document.getElementById('userName').textContent = currentUser.name;
    document.getElementById('userBMI').textContent = currentUser.bmi;
    document.getElementById('userBMR').textContent = currentUser.bmr;
    document.getElementById('userGoal').textContent = currentUser.calGoal;

    const nutrition = getDailyNutrition();
    document.getElementById('calConsumed').textContent = Math.round(nutrition.cal);
    document.getElementById('actBurned').textContent = Math.round(getActivityCalories());

    updateWaterUI();
}

function updateWater(change) {
    currentWater += change;
    if (currentWater < 0) currentWater = 0;
    saveWater();
    updateWaterUI();
}

function updateWaterUI() {
    const el = document.getElementById('waterCount');
    const st = document.getElementById('waterStatus');
    if(!el || !st) return;
    
    el.textContent = currentWater;
    
    if (currentWater < 4) {
        st.innerHTML = `⚠️ Water is low<br>💧 Drink ${8 - currentWater} more glasses`;
        st.className = 'water-status status-low';
    } else if (currentWater < 8) {
        st.innerHTML = `🚰 Stay hydrated<br>💧 Drink ${8 - currentWater} more glasses`;
        st.className = 'water-status status-low';
    } else {
        st.innerHTML = `💧 Good hydration`;
        st.className = 'water-status status-good';
    }
}

// MEALS
let activeMealTab = 'breakfast';
let selectedFood = null;

function initMeals() {
    if(!document.getElementById('searchFood')) return;
    
    renderMealList();

    // Tabs
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
            e.target.classList.add('active');
            activeMealTab = e.target.getAttribute('data-tab');
            renderMealList();
            document.getElementById('mealEntryForm').style.display = 'none';
        });
    });

    // Search
    const searchInput = document.getElementById('searchFood');
    const resultsDiv = document.getElementById('searchResults');
    
    searchInput.addEventListener('input', (e) => {
        const query = e.target.value.toLowerCase();
        if (query.length < 2) {
            resultsDiv.style.display = 'none';
            return;
        }

        const matches = (window.foodDatabase || []).filter(f => f.foodName.toLowerCase().includes(query));
        
        if (matches.length > 0) {
            resultsDiv.innerHTML = matches.map((f, i) => `
                <div class="search-item" onclick="selectFood(${i}, '${f.foodName.replace(/'/g, "\\'")}')">
                    <span>${f.foodName}</span>
                    <span style="color:var(--text-light)">${f.caloriesPer100g} kcal/100g</span>
                </div>
            `).join('');
            resultsDiv.style.display = 'block';
        } else {
            resultsDiv.style.display = 'none';
        }
    });
}

function simulateAIUpload() {
    alert("AI Detection Simulated: Found 'Chicken biriyani'");
    const fName = "Chicken biriyani";
    const idx = window.foodDatabase.findIndex(f => f.foodName === fName);
    if(idx > -1) {
        selectFood(idx, fName);
    }
}

function showManualEntry() {
    selectedFood = null;
    document.getElementById('mealEntryForm').style.display = 'block';
    document.getElementById('selectedFoodName').textContent = 'Manual Entry';
    document.getElementById('foodWeight').value = '';
}

function selectFood(index, name) {
    selectedFood = window.foodDatabase[index];
    document.getElementById('searchFood').value = '';
    document.getElementById('searchResults').style.display = 'none';
    
    document.getElementById('mealEntryForm').style.display = 'block';
    document.getElementById('selectedFoodName').textContent = name;
    document.getElementById('foodWeight').value = 100;
}

function addMealEntry() {
    const weight = parseFloat(document.getElementById('foodWeight').value);
    if (!weight || weight <= 0) return alert('Enter valid weight');

    let entry = { id: Date.now() };

    if (selectedFood) {
        const factor = weight / 100;
        entry.name = selectedFood.foodName;
        entry.weight = weight;
        entry.calories = selectedFood.caloriesPer100g * factor;
        entry.protein = selectedFood.protein * factor;
        entry.carbs = selectedFood.carbs * factor;
        entry.fat = selectedFood.fat * factor;
    } else {
        // Manual entry fallback - simplified logic
        entry.name = document.getElementById('selectedFoodName').textContent;
        entry.weight = weight;
        entry.calories = weight * 1.5; // dummy calculation
        entry.protein = weight * 0.1;
        entry.carbs = weight * 0.2;
        entry.fat = weight * 0.05;
    }

    currentMeals[activeMealTab].push(entry);
    saveMeals();
    renderMealList();
    document.getElementById('mealEntryForm').style.display = 'none';
}

function deleteMeal(id) {
    currentMeals[activeMealTab] = currentMeals[activeMealTab].filter(m => m.id !== id);
    saveMeals();
    renderMealList();
}

function renderMealList() {
    const list = document.getElementById('currentMealList');
    if(!list) return;

    if (currentMeals[activeMealTab].length === 0) {
        list.innerHTML = '<p style="color:var(--text-light); text-align:center;">No foods added yet.</p>';
        return;
    }

    list.innerHTML = currentMeals[activeMealTab].map(m => `
        <div class="food-list-item">
            <div>
                <strong>${m.name}</strong> (${m.weight}g)
                <div style="font-size:12px; color:var(--text-light)">
                    P: ${m.protein.toFixed(1)}g | C: ${m.carbs.toFixed(1)}g | F: ${m.fat.toFixed(1)}g
                </div>
            </div>
            <div style="display:flex; align-items:center; gap:15px">
                <span style="font-weight:600; color:var(--primary)">${Math.round(m.calories)} kcal</span>
                <span style="color:var(--danger); cursor:pointer;" onclick="deleteMeal(${m.id})">✖</span>
            </div>
        </div>
    `).join('');
}

// SUMMARY
function initSummary() {
    if(!document.getElementById('sumCalCons')) return;
    
    const numItems = getDailyNutrition();
    const burned = getActivityCalories();
    const remaining = currentUser.calGoal - numItems.cal + burned;

    document.getElementById('sumCalCons').textContent = Math.round(numItems.cal);
    document.getElementById('sumCalBurn').textContent = Math.round(burned);
    document.getElementById('sumCalRem').textContent = Math.round(remaining);
    
    document.getElementById('sumPro').textContent = Math.round(numItems.pro) + 'g';
    document.getElementById('sumCarb').textContent = Math.round(numItems.carbs) + 'g';
    document.getElementById('sumFat').textContent = Math.round(numItems.fat) + 'g';

    // AI Suggestions
    let sugHtml = '';
    if (numItems.pro < 50) {
        sugHtml += `<div class="suggestion-box warning">💪 Eat eggs or dal to boost protein!</div>`;
    }
    if (numItems.fat > 70) {
        sugHtml += `<div class="suggestion-box warning">⚠️ Reduce fried foods, high fat detected.</div>`;
    }
    if (numItems.cal > 0 && numItems.pro >= 50 && numItems.fat <= 70) {
        sugHtml += `<div class="suggestion-box balanced">🥗 Great job! Balanced diet maintained.</div>`;
    }
    if (numItems.cal === 0) {
        sugHtml += `<div class="suggestion-box info">Please log your meals to get insights.</div>`;
    }
    
    document.getElementById('aiSuggestions').innerHTML = sugHtml;
}

// GOALS
function initGoals() {
    if(!document.getElementById('weightHistory')) return;
    
    document.getElementById('startWeight').textContent = (weightHistory[0]?.weight || 0) + ' kg';
    document.getElementById('currentWeight').textContent = (weightHistory[weightHistory.length-1]?.weight || 0) + ' kg';

    renderWeightHistory();
}

function logWeight() {
    const w = parseFloat(document.getElementById('newWeight').value);
    if(w > 0) {
        weightHistory.push({
            date: new Date().toISOString().split('T')[0],
            weight: w
        });
        saveWeight();
        
        // Update current weight in user obj too
        currentUser.weight = w;
        currentUser.bmi = calcBMI(w, currentUser.height);
        saveUser(currentUser);
        
        document.getElementById('currentWeight').textContent = w + ' kg';
        renderWeightHistory();
        document.getElementById('newWeight').value = '';
    }
}

function renderWeightHistory() {
    const tbody = document.getElementById('weightHistory');
    if(!tbody) return;
    tbody.innerHTML = weightHistory.slice().reverse().map(entry => `
        <tr>
            <td>${entry.date}</td>
            <td>${entry.weight} kg</td>
        </tr>
    `).join('');
}


// PROGRESS (Requires Chart.js)
function initProgress() {
    if(typeof Chart === 'undefined') {
        setTimeout(initProgress, 100);
        return;
    }

    if(!document.getElementById('progBMI')) return;

    document.getElementById('progBMI').textContent = currentUser.bmi;
    document.getElementById('progBMR').textContent = currentUser.bmr;
    document.getElementById('progGoal').textContent = currentUser.calGoal;

    const nut = getDailyNutrition();
    const burned = getActivityCalories();

    // Chart 1: Calories Breakdown
    const ctxC = document.getElementById('calChart').getContext('2d');
    new Chart(ctxC, {
        type: 'bar',
        data: {
            labels: ['Consumed', 'Burned', 'Goal'],
            datasets: [{
                label: 'Calories',
                data: [nut.cal, burned, currentUser.calGoal],
                backgroundColor: ['#e74c3c', '#3498db', '#2ecc71']
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });

    // Chart 2: Weight Trend
    const ctxW = document.getElementById('weightChart').getContext('2d');
    const dates = weightHistory.map(w => w.date);
    const weights = weightHistory.map(w => w.weight);

    new Chart(ctxW, {
        type: 'line',
        data: {
            labels: dates,
            datasets: [{
                label: 'Weight (kg)',
                data: weights,
                borderColor: '#2ecc71',
                tension: 0.1,
                fill: false
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false
        }
    });
}

// Activity logic (applies across layout depending on where form is, adding it to dashboard)
function addActivity() {
    const name = document.getElementById('actName').value;
    const dur = parseInt(document.getElementById('actDur').value);
    if(name && dur > 0) {
        // Simple rough calc: 5 cals per minute of generic activity
        const burn = dur * 5; 
        currentActivities.push({
            id: Date.now(),
            name,
            duration: dur,
            caloriesBurned: burn
        });
        saveActivity();
        document.getElementById('actName').value = '';
        document.getElementById('actDur').value = '';
        
        // Refresh dashboard numbers if on dashboard
        if(document.getElementById('actBurned')) {
            initDashboard();
        }
    }
}
