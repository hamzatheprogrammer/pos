const fetchproductsnumber = async () => {
    try {
        const response = await fetch('/api/items/count');
        const data = await response.json();

        const totalProducts = data.totalItems || 0;
        const categoryData = data.result || [];   

        document.getElementById('productCount').textContent = totalProducts;

        return { totalProducts, categoryData };
    } catch (error) {
        console.error('Error fetching total products:', error);
        return { totalProducts: 0, categoryData: [] };
    }
};





async function productChart() {
    const ctx = document.getElementById('productschart');

    const { categoryData } = await fetchproductsnumber();

    const labels = categoryData.map(item => item._id);
    const values = categoryData.map(item => item.total);

    new Chart(ctx, {
        type: 'pie',
        data: {
            labels: labels,
            datasets: [{
                data: values,
                backgroundColor: [
                    'red', 'blue', 'green', 'orange', 'purple', 'grey'
                ]
            }]
        }
    });
}

document.addEventListener('DOMContentLoaded', productChart);