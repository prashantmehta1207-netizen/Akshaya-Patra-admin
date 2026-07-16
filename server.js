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
const SNIPE_IT_KEY = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiJ9.eyJhdWQiOiIzIiwianRpIjoiNjEyMjUyZTkzODM5ZThmMGZlNWJmNzUzOGFmNjdiN2ViMjljNjkyNzYxYjZhYzIzMGMwMzE2OTcxY2NmOWM1NGIwNDUzZTNhOTQxYTU3Y2QiLCJpYXQiOjE3ODQxMjI0NzguMTk0NDkyLCJuYmYiOjE3ODQxMjI0NzguMTk0NDkzLCJleHAiOjI0MTUyNzQ0NzguMTg4NzY3LCJzdWIiOiIxIiwic2NvcGVzIjpbXX0.IXZAkE9FPGwCfj51_v-Yl8kr1T-xwMp07RpJiY7erQ20jDkhjIDSoID0iabFVuNu90zZqIZ06XgU3kU0Vg5QsKDV5Pmveu9pOLVHgGtPUTeknGL3T0tHE9Qyt788Cw6plou2nN2ZcJFt99KLBUJ9jGEeJAQDmwidEpNje_1imLcssax_PcldUxPsNO29nULZVDtThgsOI3IBRODqvmgTAlgcm7KVa0HBaIDPxKY-X0hD6b7cKkndGUHwJUll4THFOrO8Sd5oZnMQ1eS_IgX_MucRBCRmFfaMVh4Y4oMuuzlp8DBt3lcPfNZpNCNjHKjQPUp6iaiU_LWbpCyUt72tYshmES9YqwGQ7cbIWfncFQOuLTHQLDN7jnKML4ZoI6kKSlpR4H87Pf3hOnguLtqKH65FqfBpgKAtupnWGfke9t_kD-8o7jts5CpLlsOnBSeEa7XA3nS9_5iK0cm22fuqYuS3D3f8cGdpnJ8VGG3QUD600Fgv3-aF17iVaFlENMawZOAJ6WnwCTbuow4O0ocmjrofw28KdbgRxUI7xxiUGPN4xbV02ag_3lrTOgnsMaQk-xA1OznOCrIK1kQX1C_K8u_UH7zObUJobzfmWDC7afdBRYqcpslpI8xUbinTcfoOG8eIeT_IyRXT_iR1Zwt_1BBqbKZwEb_oPJX-rPB5sDs"; // 👈 તમારો સાચો API Token અહીં નાખો

// ૧. બધી ફરિયાદો મેળવવા માટે (GET API)
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

// ૨. ફરિયાદ અપડેટ કરવા માટે (PUT API - MySQL Status + Snipe-IT Close Sync)
app.put('/api/complaints/:id', (req, res) => {
    const { status, adminRemarks } = req.body;
    const { id } = req.params;

    console.log(`\n=== 🔄 Synching Status Update for Local Row ID: ${id} ===`);

    // પહેલાં લોકલ MySQL માંથી complaintId (CMP-XXXX) અને assetId મેળવો
    const selectQuery = 'SELECT complaintId, assetId, description FROM complaints WHERE id = ?';

    db.query(selectQuery, [id], async (selectErr, results) => {
        if (selectErr || results.length === 0) {
            console.error("❌ Complaint fetch error:", selectErr);
            return res.status(404).json({ error: "Complaint not found" });
        }

        const { complaintId, assetId, description } = results[0];
        console.log(`DB Fetched -> ComplaintID: ${complaintId}, Snipe-IT AssetID: ${assetId}`);

        // જો સ્ટેટસ 'Resolved' કે 'Closed' થાય અને assetId હોય, તો જ Snipe-IT અપડેટ કરો
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
                    const searchId = complaintId.trim().toUpperCase();

                    // 🎯 બુલેટપ્રૂફ ફિલ્ટર લોજિક: title, name અથવા notes ગમે ત્યાં CMP ID મેચ થવો જોઈએ
                    const openM = mSearch.data.rows.find(m => {
                        const isNotCompleted = !m.completion_date;
                        const mTitle = m.title ? String(m.title).toUpperCase() : "";
                        const mName = m.name ? String(m.name).toUpperCase() : "";
                        const mNotes = m.notes ? String(m.notes).toUpperCase() : "";

                        return isNotCompleted && (mTitle.includes(searchId) || mName.includes(searchId) || mNotes.includes(searchId));
                    });

                    if (openM) {
                        console.log(`🎯 Open Maintenance Found in Snipe-IT (ID: ${openM.id}). Closing now...`);

                        // Snipe-IT મેઈન્ટેનન્સને PUT રિક્વેસ્ટથી ક્લોઝ કરો
                        await axios.put(`${SNIPE_IT_URL}/maintenances/${openM.id}`, {
                            asset_id: assetId,
                            asset_maintenance_type: 'Repair',
                            title: openM.title || openM.name,
                            name: openM.name || openM.title,
                            completion_date: new Date().toISOString().split('T')[0], // આજની તારીખ
                            notes: `${description || ''} | Remarks: ${adminRemarks || 'None'}`,
                            cost: "0"
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
                console.error("❌ Snipe-IT API Error:");
                if (snipeErr.response) {
                    console.error(`Status: ${snipeErr.response.status}`);
                    console.error(`Data:`, snipeErr.response.data);
                } else {
                    console.error(snipeErr.message);
                }
            }
        }

        // છેલ્લે લોકલ MySQL ડેટાબેઝ અપડેટ કરો
        const updateQuery = 'UPDATE complaints SET status = ?, adminRemarks = ? WHERE id = ?';
        db.query(updateQuery, [status, adminRemarks, id], (err, result) => {
            if (err) {
                console.error("❌ MySQL Update Error:", err);
                return res.status(500).json({ error: err.message });
            }
            console.log("✅ Local MySQL DB Updated!");
            res.json({ success: true, message: 'Database and Snipe-IT processes completed.' });
        });
    });
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