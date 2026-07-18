const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');
const axios = require('axios');

const app = express();

// 🌐 CORS Configuration - જેથી ફ્રન્ટએન્ડ Port 5001 સાથે વાત કરી શકે
app.use(cors({
    origin: '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// 🗄️ MySQL Database Connection (બંને બેકએન્ડ આ જ DB વાપરે છે)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',
    password: 'Prashant1209',              // જો તમારો પાસવર્ડ હોય તો અહીં નાખો
    database: 'akshaya_patra_db',
    port: 3306
});

db.connect((err) => {
    if (err) {
        console.error("❌ Database Error: " + err.message);
        return;
    }
    console.log("✅ Admin Server successfully connected to MySQL!");
});

// 🔑 Snipe-IT API Configuration
const SNIPE_IT_URL = "http://localhost:8000/api/v1";
// ⚠️ અહીં તમારી સાચી Snipe-IT API Key (Bearer Token) ડબલ કોટ્સમાં મુકવી
const SNIPE_IT_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzIiwianRpIjoiNjEyMjUyZTkzODM5ZThmMGZlNWJmNzUzOGFmNjdiN2ViMjljNjkyNzYxYjZhYzIzMGMwMzE2OTcxY2NmOWM1NGIwNDUzZTNhOTQxYTU3Y2QiLCJpYXQiOjE3ODQxMjI0NzguMTk0NDkyLCJuYmYiOjE3ODQxMjI0NzguMTk0NDkzLCJleHAiOjI0MTUyNzQ0NzguMTg4NzY3LCJzdWIiOiIxIiwic2NvcGVzIjpbXX0.IXZAkE9FPGwCfj51_v-Yl8kr1T-xwMp07RpJiY7erQ20jDkhjIDSoID0iabFVuNu90zZqIZ06XgU3kU0Vg5QsKDV5Pmveu9pOLVHgGtPUTeknGL3T0tHE9Qyt788Cw6plou2nN2ZcJFt99KLBUJ9jGEeJAQDmwidEpNje_1imLcssax_PcldUxPsNO29nULZVDtThgsOI3IBRODqvmgTAlgcm7KVa0HBaIDPxKY-X0hD6b7cKkndGUHwJUll4THFOrO8Sd5oZnMQ1eS_IgX_MucRBCRmFfaMVh4Y4oMuuzlp8DBt3lcPfNZpNCNjHKjQPUp6iaiU_LWbpCyUt72tYshmES9YqwGQ7cbIWfncFQOuLTHQLDN7jnKML4ZoI6kKSlpR4H87Pf3hOnguLtqKH65FqfBpgKAtupnWGfke9t_kD-8o7jts5CpLlsOnBSeEa7XA3nS9_5iK0cm22fuqYuS3D3f8cGdpnJ8VGG3QUD600Fgv3-aF17iVaFlENMawZOAJ6WnwCTbuow4O0ocmjrofw28KdbgRxUI7xxiUGPN4xbV02ag_3lrTOgnsMaQk-xA1OznOCrIK1kQX1C_K8u_UH7zObUJobzfmWDC7afdBRYqcpslpI8xUbinTcfoOG8eIeT_IyRXT_iR1Zwt_1BBqbKZwEb_oPJX-rPB5sDs";

// ====================================================================
// ૧. બધો મેઇન્ટેનન્સ ડેટા Snipe-IT માંથી મેળવવા માટે (GET API)
// ====================================================================
app.get('/api/maintenances', async (req, res) => {
    try {
        console.log("📡 Fetching asset maintenances from Snipe-IT...");

        const response = await axios.get(`${SNIPE_IT_URL}/maintenances?expand=asset&limit=500`, {
            headers: {
                'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                'Accept': 'application/json'
            }
        });

        return res.status(200).json({
            success: true,
            rows: response.data.rows || []
        });
    } catch (error) {
        console.error("❌ GET /api/maintenances Error:", error.message);
        return res.status(500).json({
            success: false,
            error: "Snipe-IT માંથી ડેટા લોડ કરવામાં ભૂલ આવી અથવા કનેક્શન ન થયું."
        });
    }
});

// ====================================================================
// 🎯 ૨. નવો મેઇન્ટેનન્સ લોગ Snipe-IT માં સેવ કરવા અને `complaints` ટેબલ UPDATE કરવા માટે (POST API)
// ====================================================================
app.post('/api/maintenances', async (req, res) => {
    try {
        const { asset_id, title, maintenance_type, start_date, completion_date, cost, notes, resolvedBy } = req.body;

        // જરૂરી વેલિડેશન ચેક કરો
        if (!asset_id || !title || !maintenance_type || !start_date || !cost) {
            return res.status(400).json({
                success: false,
                error: "કૃપા કરીને બધી જ જરૂરી (*) વિગતો ભરો."
            });
        }

        console.log(`📡 Asset Tag: ${asset_id} માટે સાચું Snipe-IT Internal ID શોધાઈ રહ્યું છે...`);
        let actualSnipeAssetId = null;

        try {
            const assetSearchResponse = await axios.get(`${SNIPE_IT_URL}/hardware/bytag/${asset_id}`, {
                headers: {
                    'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                    'Accept': 'application/json'
                }
            });

            if (assetSearchResponse.data && assetSearchResponse.data.id) {
                actualSnipeAssetId = assetSearchResponse.data.id;
            } else if (assetSearchResponse.data && assetSearchResponse.data.rows && assetSearchResponse.data.rows.length > 0) {
                actualSnipeAssetId = assetSearchResponse.data.rows[0].id;
            }

            if (actualSnipeAssetId) {
                console.log(`🎯 સાચું ID મળી ગયું! Asset Tag: ${asset_id} -> Snipe ID: ${actualSnipeAssetId}`);
            } else {
                return res.status(404).json({
                    success: false,
                    error: `Snipe-IT માં Asset Tag '${asset_id}' ની કોઈ એસેટ મળી નથી.`
                });
            }
        } catch (searchErr) {
            console.error("❌ Asset ID શોધવામાં ભૂલ આવી:", searchErr.message);
            return res.status(404).json({
                success: false,
                error: `Snipe-IT માં Asset Tag '${asset_id}' વેલિડેટ ન થઈ શક્યો.`
            });
        }

        // 📅 તારીખનું ફોર્મેટ ફિક્સ કરો (Snipe-IT ને YYYY-MM-DD જોઈએ)
        const formatToSnipeDate = (dateStr) => {
            if (!dateStr) return null;
            if (dateStr.includes('/')) {
                const parts = dateStr.split('/');
                if (parts[2] && parts[1] && parts[0]) {
                    return `${parts[2]}-${parts[1]}-${parts[0]}`; // DD/MM/YYYY -> YYYY-MM-DD
                }
            }
            return dateStr;
        };

        const snipeStartDate = formatToSnipeDate(start_date);
        const snipeCompletionDate = formatToSnipeDate(completion_date);

        // 🎯 Snipe-IT માટે સ્ટ્રિંગ ટાઇપને સાચા Integer ID માં કન્વર્ટ કરો
        const typeMapping = {
            'Repair': 4,
            'Hardware Support': 3,
            'Software Support': 2,
            'Patches': 1
        };

        const finalMaintenanceTypeId = typeMapping[maintenance_type] || parseInt(maintenance_type) || 4;

        // 🛠️ સાચો અને વેલિડ પેલોડ
        const snipePayload = {
            asset_id: parseInt(actualSnipeAssetId),
            name: title,
            maintenance_type_id: finalMaintenanceTypeId,
            asset_maintenance_type: maintenance_type,
            start_date: snipeStartDate,
            completion_date: snipeCompletionDate,
            cost: parseFloat(cost),
            notes: notes || ""
        };

        console.log("📡 Snipe-IT માં લોગ સબમિટ થઈ રહ્યો છે, પેલોડ:", snipePayload);
        const response = await axios.post(`${SNIPE_IT_URL}/maintenances`, snipePayload, {
            headers: {
                'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                'Accept': 'application/json',
                'Content-Type': 'application/json'
            }
        });

        if (response.data && response.data.status !== 'error') {
            console.log("✅ New maintenance logged successfully in Snipe-IT!");

            const sqlUpdate = `
                UPDATE complaints 
                SET status = 'Resolved', 
                    totalCost = ?, 
                    resolvedBy = ?, 
                    description = CONCAT(IFNULL(description, ''), '\n[Maintenance Notes]: ', ?) 
                WHERE assetTag = ? AND status = 'Pending' 
                ORDER BY id DESC LIMIT 1`;

            const values = [
                parseFloat(cost),
                resolvedBy || 'Admin',
                notes || 'Resolved from Dashboard Admin Portal.',
                asset_id
            ];

            db.query(sqlUpdate, values, (mysqlErr, mysqlResult) => {
                if (mysqlErr) {
                    console.error("❌ MySQL Update Error:", mysqlErr.message);
                    return res.status(201).json({
                        success: true,
                        message: "મેઇન્ટેનન્સ લોગ Snipe-IT માં ઉમેરાયો, પણ complaints ટેબલ અપડેટ ન થયું."
                    });
                }

                console.log("🗄️ Success! Updated existing row in 'complaints' table.");
                return res.status(201).json({
                    success: true,
                    message: "મેઇન્ટેનન્સ સફળતાપૂર્વક સબમિટ થઈ ગયું અને complaints ટેબલ લાઈવ અપડેટ થઈ ગયું!"
                });
            });

        } else {
            const errMessage = typeof response.data.messages === 'object'
                ? JSON.stringify(response.data.messages)
                : response.data.messages;

            return res.status(400).json({
                success: false,
                error: errMessage || "Snipe-IT એ રિક્વેસ્ટ રીજેક્ટ કરી."
            });
        }
    } catch (error) {
        console.error("❌ POST /api/maintenances Error:", error.message);
        return res.status(500).json({
            success: false,
            error: "સર્વર સાથે જોડાણ થઈ શક્યું નહીં."
        });
    }
});

// ૩. બધી ફરિયાદો મેળવવા માટે (GET API)
app.get('/api/complaints', (req, res) => {
    const query = 'SELECT * FROM complaints ORDER BY id DESC';
    db.query(query, (err, results) => {
        if (err) {
            console.error(err);
            return res.status(500).json({ error: err.message });
        }
        res.json(results);
    });
});

// ====================================================================
// ૪. ફરિયાદ અપડેટ કરવા માટે (PUT API - MySQL Status + Snipe-IT Close Sync)
// ====================================================================
app.put('/api/complaints/:id', (req, res) => {
    const { status, adminRemarks, resolvedBy, totalCost } = req.body;
    const { id } = req.params;

    console.log(`\n=== 🔄 Synching Status Update for Local Row ID: ${id} ===`);

    const selectQuery = 'SELECT complaintId, assetId, description FROM complaints WHERE id = ?';

    db.query(selectQuery, [id], async (selectErr, results) => {
        if (selectErr || results.length === 0) {
            console.error("❌ Complaint fetch error:", selectErr);
            return res.status(404).json({ error: "Complaint not found" });
        }

        const { complaintId, assetId, description } = results[0];
        console.log(`DB Fetched -> ComplaintID: ${complaintId}, Snipe-IT AssetID: ${assetId}`);

        if ((status === 'Resolved' || status === 'Closed') && assetId) {
            try {
                console.log(`📡 Snipe-IT માંથી ઓપન મેઈન્ટેનન્સ સર્ચ થઈ રહ્યું છે (Limit: 500)...`);

                const mSearch = await axios.get(`${SNIPE_IT_URL}/maintenances?asset_id=${assetId}&limit=500`, {
                    headers: {
                        'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                        'Accept': 'application/json'
                    }
                });

                if (mSearch.data && mSearch.data.rows) {
                    const searchId = complaintId ? complaintId.trim().toUpperCase() : "";

                    const openM = mSearch.data.rows.find(m => {
                        const isNotCompleted = !m.completion_date;
                        const mTitle = m.title ? String(m.title).toUpperCase() : "";
                        const mName = m.name ? String(m.name).toUpperCase() : "";
                        const mNotes = m.notes ? String(m.notes).toUpperCase() : "";

                        return isNotCompleted && (searchId === "" || mTitle.includes(searchId) || mName.includes(searchId) || mNotes.includes(searchId));
                    });

                    if (openM) {
                        console.log(`🎯 Open Maintenance Found in Snipe-IT (ID: ${openM.id}). Closing now...`);

                        await axios.put(`${SNIPE_IT_URL}/maintenances/${openM.id}`, {
                            asset_id: parseInt(assetId),
                            asset_maintenance_type: openM.asset_maintenance_type || 'Repair',
                            title: openM.title || openM.name || "Fixed",
                            name: openM.name || openM.title || "Fixed",
                            completion_date: new Date().toISOString().split('T')[0],
                            notes: `${description || ''} | Remarks: ${adminRemarks || 'None'} | Resolved By: ${resolvedBy || 'Admin'}`,
                            cost: totalCost ? parseFloat(totalCost) : 0
                        }, {
                            headers: {
                                'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                                'Accept': 'application/json',
                                'Content-Type': 'application/json'
                            }
                        });
                        console.log(`✅ Snipe-IT Maintenance ID ${openM.id} closed successfully!`);
                    } else {
                        console.log(`⚠️ '${searchId}' માટે Snipe-IT માં કોઈ ઓપન (Active) મેઈન્ટેનન્સ ન મળ્યું.`);
                    }
                }
            } catch (snipeErr) {
                console.error("❌ Snipe-IT API Error during PUT Update:", snipeErr.response ? JSON.stringify(snipeErr.response.data) : snipeErr.message);
            }
        }

        // સ્થાનિક MySQL ડેટાબેઝ અપડેટ કરો
        const updateQuery = `
            UPDATE complaints 
            SET status = ?, 
                resolvedBy = ?, 
                totalCost = ? 
            WHERE id = ?`;

        const updateValues = [
            status,
            resolvedBy || null,
            totalCost ? parseFloat(totalCost) : 0.00,
            id
        ];

        db.query(updateQuery, updateValues, (err, result) => {
            if (err) {
                console.error("❌ MySQL Update Error:", err);
                return res.status(500).json({ error: err.message });
            }
            console.log("✅ Local MySQL DB Updated with Resolved By & Total Cost fields!");
            res.json({ success: true, message: 'Database and Snipe-IT processes completed.' });
        });
    });
});

// ====================================================================
// 🗑️ ૫. ખોટો મેઇન્ટેનન્સ લોગ Snipe-IT માંથી તાત્કાલિક ડિલીટ કરવા માટે (NEW DELETE API)
// ====================================================================
app.delete('/api/maintenances/:id', async (req, res) => {
    try {
        const maintenanceId = req.params.id;
        console.log(`🗑️ Deleting maintenance log ID: ${maintenanceId} from Snipe-IT...`);

        const response = await axios.delete(`${SNIPE_IT_URL}/maintenances/${maintenanceId}`, {
            headers: {
                'Authorization': `Bearer ${SNIPE_IT_KEY}`,
                'Accept': 'application/json'
            }
        });

        if (response.data && response.data.status === 'success') {
            return res.status(200).json({
                success: true,
                message: `મેઇન્ટેનન્સ લોગ ID ${maintenanceId} સફળતાપૂર્વક ડિલીટ થઈ ગયો છે.`
            });
        } else {
            return res.status(400).json({
                success: false,
                error: response.data.messages || "Snipe-IT એ ડિલીટ રિક્વેસ્ટ રીજેક્ટ કરી."
            });
        }
    } catch (error) {
        console.error("❌ DELETE /api/maintenances Error:", error.message);
        return res.status(500).json({
            success: false,
            error: "સર્વરથી ડિલીટ કરવામાં ભૂલ આવી અથવા આ ID અસ્તિત્વમાં નથી."
        });
    }
});

// --- ADMIN PROFILE APIs ---
app.get('/api/admin/profile/:id', (req, res) => {
    const adminId = req.params.id;
    const query = "SELECT id, name, email, phone, department, role FROM admins WHERE id = ?";
    db.query(query, [adminId], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (result.length === 0) return res.status(404).json({ message: "Admin not found" });
        res.json(result[0]);
    });
});

app.put('/api/admin/profile/update/:id', (req, res) => {
    const adminId = req.params.id;
    const { name, email, phone } = req.body;
    const query = "UPDATE admins SET name = ?, email = ?, phone = ? WHERE id = ?";
    db.query(query, [name, email, phone, adminId], (err, result) => {
        if (err) return res.status(500).json({ error: "Failed to update profile" });
        res.json({ message: "Profile updated successfully!" });
    });
});

app.put('/api/admin/profile/password/:id', (req, res) => {
    const adminId = req.params.id;
    const { currentPassword, newPassword } = req.body;
    const checkQuery = "SELECT password FROM admins WHERE id = ?";
    db.query(checkQuery, [adminId], (err, result) => {
        if (err) return res.status(500).json({ error: "Database error" });
        if (result.length === 0) return res.status(404).json({ message: "Admin not found" });
        if (result[0].password !== currentPassword) return res.status(400).json({ message: "Current password does not match!" });

        const updateQuery = "UPDATE admins SET password = ? WHERE id = ?";
        db.query(updateQuery, [newPassword, adminId], (err, updateResult) => {
            if (err) return res.status(500).json({ error: "Failed to update password" });
            res.json({ message: "Password updated successfully!" });
        });
    });
});

// 🚀 એડમિન સર્વર પોર્ટ 5001 પર ચાલશે
const PORT = 5001;
app.listen(PORT, () => {
    console.log(`🚀 Admin Backend Server running on http://localhost:${PORT}`);
});